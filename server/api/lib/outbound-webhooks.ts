/**
 * Outbound partner webhooks — enqueue + deliver signed event callbacks.
 *
 * emitPartnerEvent() fans an event to a B2B account's active subscriptions
 * (fail-open, fire-and-forget). deliverPendingWebhooks() is the cron worker:
 * it claims due deliveries, POSTs with an HMAC-SHA256 signature, and retries
 * with exponential backoff, dead-lettering after MAX_ATTEMPTS.
 */
import crypto from "crypto";
import { db } from "@/db";
import { webhookSubscriptions, webhookDeliveries } from "@/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { logger } from "@/lib/logger";

const MAX_ATTEMPTS = 6;
const BACKOFF_BASE_MS = 60_000; // 1m, 2m, 4m, ... capped

export function signPayload(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

/** Enqueue an event for all of an account's active subscriptions to that type. */
export async function emitPartnerEvent(
  accountId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const subs = await db
      .select()
      .from(webhookSubscriptions)
      .where(and(eq(webhookSubscriptions.accountId, accountId), eq(webhookSubscriptions.active, true)));
    const matching = subs.filter((s) => s.events.includes(eventType));
    if (matching.length === 0) return;
    await db.insert(webhookDeliveries).values(
      matching.map((s) => ({ subscriptionId: s.id, eventType, payload })),
    );
  } catch (err) {
    logger.error("[OutboundWebhooks] emit failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

/** Cron worker: deliver due pending deliveries. */
export async function deliverPendingWebhooks(now: Date = new Date()): Promise<{ attempted: number; delivered: number }> {
  const due = await db
    .select()
    .from(webhookDeliveries)
    .where(and(eq(webhookDeliveries.status, "pending"), lte(webhookDeliveries.nextAttemptAt, now)))
    .limit(100);

  let delivered = 0;
  for (const d of due) {
    // Claim this attempt: bump attempts only if unchanged (avoids double-send).
    const [claimed] = await db
      .update(webhookDeliveries)
      .set({ attempts: d.attempts + 1 })
      .where(and(eq(webhookDeliveries.id, d.id), eq(webhookDeliveries.attempts, d.attempts)))
      .returning();
    if (!claimed) continue;

    const sub = await db.query.webhookSubscriptions.findFirst({
      where: eq(webhookSubscriptions.id, d.subscriptionId),
    });
    if (!sub || !sub.active) {
      await db.update(webhookDeliveries).set({ status: "failed", lastError: "subscription inactive" }).where(eq(webhookDeliveries.id, d.id));
      continue;
    }

    const body = JSON.stringify({ event: d.eventType, data: d.payload, deliveryId: d.id });
    try {
      const res = await fetch(sub.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-roadsidega-event": d.eventType,
          "x-roadsidega-signature": signPayload(sub.secret, body),
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        await db.update(webhookDeliveries).set({ status: "delivered", deliveredAt: new Date(), lastError: null }).where(eq(webhookDeliveries.id, d.id));
        delivered++;
        continue;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const attempts = claimed.attempts;
      if (attempts >= MAX_ATTEMPTS) {
        await db.update(webhookDeliveries).set({ status: "failed", lastError: msg }).where(eq(webhookDeliveries.id, d.id));
      } else {
        const backoff = BACKOFF_BASE_MS * 2 ** (attempts - 1);
        await db.update(webhookDeliveries).set({ nextAttemptAt: new Date(now.getTime() + backoff), lastError: msg }).where(eq(webhookDeliveries.id, d.id));
      }
    }
  }
  return { attempted: due.length, delivered };
}

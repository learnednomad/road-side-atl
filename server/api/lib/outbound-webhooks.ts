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

/**
 * SSRF guard: only deliver to public http(s) endpoints. Blocks loopback,
 * link-local (incl. the 169.254.169.254 cloud-metadata IP), private ranges, and
 * internal hostnames. (Hostname-literal check; DNS-rebinding to an internal IP
 * is a deeper follow-up — would require resolving + re-checking the address.)
 */
export function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  // URL.hostname keeps brackets for IPv6 literals ("[::1]") — strip them.
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return false;
  }
  // IPv6 loopback / link-local (fe80::/10) / unique-local (fc00::/7).
  if (host.includes(":") && (host === "::1" || host.startsWith("fe80") || host.startsWith("fc") || host.startsWith("fd"))) {
    return false;
  }
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (
      a === 0 ||
      a === 127 || // loopback
      a === 10 || // private
      (a === 169 && b === 254) || // link-local incl. cloud metadata
      (a === 172 && b >= 16 && b <= 31) || // private
      (a === 192 && b === 168) || // private
      (a === 100 && b >= 64 && b <= 127) // CGNAT
    ) {
      return false;
    }
  }
  return true;
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

    // SSRF guard: never let a partner-registered URL point the cron at an
    // internal/loopback/metadata address.
    if (!isPublicHttpUrl(sub.url)) {
      logger.error("[OutboundWebhook] blocked non-public delivery URL", { deliveryId: d.id, subscriptionId: sub.id });
      await db.update(webhookDeliveries).set({ status: "failed", lastError: "blocked: non-public URL" }).where(eq(webhookDeliveries.id, d.id));
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

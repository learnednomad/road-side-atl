/**
 * Stripe subscription lifecycle → membership status (registered in the 0c
 * extension registry). The subscription carries {userId, planId, discountBp} in
 * metadata (set at checkout), so created/updated upsert the membership and
 * deleted cancels it. Fail-open; event-level dedup handles redelivery.
 */
import type Stripe from "stripe";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { triggerNovu, WF, custSub } from "@/lib/notifications/novu";

function mapStatus(s: string): "active" | "past_due" | "canceled" {
  if (s === "active" || s === "trialing") return "active";
  if (s === "past_due" || s === "unpaid") return "past_due";
  return "canceled";
}

export async function handleSubscriptionUpsert(event: Stripe.Event): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  const userId = sub.metadata?.userId;
  const planId = sub.metadata?.planId;
  if (!userId || !planId) return; // not a membership subscription
  const discountBp = Number(sub.metadata?.discountBp ?? 0) || 0;
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  try {
    const existing = await db.query.memberships.findFirst({
      where: eq(memberships.stripeSubscriptionId, sub.id),
    });
    const values = {
      userId,
      planId,
      status: mapStatus(sub.status),
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      discountBp,
      updatedAt: new Date(),
    };
    if (existing) {
      await db.update(memberships).set(values).where(eq(memberships.id, existing.id));
    } else {
      await db.insert(memberships).values(values);
    }

    // Novu: mirror the membership status change into the customer's Inbox
    const planName = sub.metadata?.planName || "your plan";
    if (values.status === "active") {
      void triggerNovu(WF.membershipActivated, custSub(userId), { planName });
    } else if (values.status === "past_due") {
      void triggerNovu(WF.membershipPastDue, custSub(userId), {
        planName,
        billingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://roadsidega.com"}/account/membership`,
      });
    } else if (values.status === "canceled") {
      void triggerNovu(WF.membershipCanceled, custSub(userId), { planName });
    }
  } catch (err) {
    logger.error("[Webhook] subscription upsert failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  try {
    await db.update(memberships).set({ status: "canceled", updatedAt: new Date() }).where(eq(memberships.stripeSubscriptionId, sub.id));

    // Novu: notify customer their membership was canceled
    const userId = sub.metadata?.userId;
    if (userId) {
      void triggerNovu(WF.membershipCanceled, custSub(userId), { planName: sub.metadata?.planName || "your plan" });
    }
  } catch (err) {
    logger.error("[Webhook] subscription delete failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

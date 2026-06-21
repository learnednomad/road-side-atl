/**
 * Stripe subscription lifecycle → membership status (registered in the 0c
 * extension registry). The subscription carries {userId, planId, discountBp} in
 * metadata (set at checkout), so created/updated upsert the membership and
 * deleted cancels it.
 *
 * Fail-CLOSED: the upsert is a single race-free onConflictDoUpdate keyed on the
 * unique memberships.stripeSubscriptionId, and any DB error propagates so the
 * caller does NOT mark the event processed and Stripe retries. Notifications stay
 * fire-and-forget (void) with a stable transactionId and are never on the 500 path.
 */
import type Stripe from "stripe";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { eq } from "drizzle-orm";
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
  const values = {
    userId,
    planId,
    status: mapStatus(sub.status),
    stripeSubscriptionId: sub.id,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    discountBp,
    updatedAt: new Date(),
  };

  // Race-free single statement: stripeSubscriptionId is .unique() so a concurrent
  // redelivery resolves to the same row. Any other DB error propagates (fail-closed).
  await db
    .insert(memberships)
    .values(values)
    .onConflictDoUpdate({
      target: memberships.stripeSubscriptionId,
      set: {
        status: values.status,
        currentPeriodEnd: values.currentPeriodEnd,
        discountBp: values.discountBp,
        updatedAt: values.updatedAt,
        planId: values.planId,
      },
    });

  // Novu: mirror the membership status change into the customer's Inbox.
  // Fire-and-forget with a stable transactionId so Stripe-driven retries never
  // double-post to the customer Inbox.
  const planName = sub.metadata?.planName || "your plan";
  if (values.status === "active") {
    void triggerNovu(WF.membershipActivated, custSub(userId), { planName }, { transactionId: `${sub.id}:${values.status}` });
  } else if (values.status === "past_due") {
    void triggerNovu(
      WF.membershipPastDue,
      custSub(userId),
      {
        planName,
        billingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://roadsidega.com"}/account/membership`,
      },
      { transactionId: `${sub.id}:${values.status}` },
    );
  } else if (values.status === "canceled") {
    void triggerNovu(WF.membershipCanceled, custSub(userId), { planName }, { transactionId: `${sub.id}:${values.status}` });
  }
}

export async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;

  // Single keyed update; any DB error propagates (fail-closed) so the event is
  // not marked processed and Stripe retries.
  await db.update(memberships).set({ status: "canceled", updatedAt: new Date() }).where(eq(memberships.stripeSubscriptionId, sub.id));

  // Novu: notify customer their membership was canceled (fire-and-forget, stable
  // transactionId so a redelivery does not double-post).
  const userId = sub.metadata?.userId;
  if (userId) {
    void triggerNovu(WF.membershipCanceled, custSub(userId), { planName: sub.metadata?.planName || "your plan" }, { transactionId: `${sub.id}:canceled` });
  }
}

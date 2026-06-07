/**
 * Extension registry for Stripe webhook events that are NOT in the core switch
 * in webhooks.ts. New event handling (Phase 4c invoice.paid, Phase 5b
 * customer.subscription.* / invoice.paid for memberships) registers here instead
 * of growing the main switch. The dispatcher in webhooks.ts looks up the handler
 * by event.type in its default branch; an unmatched event is recorded as
 * "skipped" for observability.
 *
 * Handlers receive the verified Stripe.Event and own their own idempotency for
 * any side effects (the event-level dedup in webhooks.ts already prevents
 * reprocessing the same event id).
 */
import type Stripe from "stripe";
import { handleInvoicePaid } from "./invoice-paid";
import { handleSubscriptionUpsert, handleSubscriptionDeleted } from "./subscription";

export type StripeWebhookHandler = (event: Stripe.Event) => Promise<void>;

export const stripeExtensionHandlers: Record<string, StripeWebhookHandler> = {
  "invoice.paid": handleInvoicePaid, // Phase 4c — B2B NET credit paydown
  "customer.subscription.created": handleSubscriptionUpsert, // Phase 5b — memberships
  "customer.subscription.updated": handleSubscriptionUpsert,
  "customer.subscription.deleted": handleSubscriptionDeleted,
};

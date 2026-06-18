/**
 * Novu notification adapter (self-hosted, https://novu-api.roadsidega.com).
 *
 * Design (PHASE 1): Novu powers the net-new in-app Inbox. It runs ALONGSIDE the
 * existing Resend/Twilio/web-push senders in this folder — every notification
 * event is also mirrored into Novu so it appears in the user's Inbox, with no
 * double-send because only the in_app channel is active in the workflows (see
 * scripts/seed-novu-workflows.mjs). PHASE 2: activate the email/SMS/push steps
 * in Novu, configure its Resend/Twilio integrations, and retire the legacy
 * senders — no app code changes needed beyond removing the legacy calls.
 *
 * Everything here is fire-and-forget and fully gated by NOVU_ENABLED: when the
 * flag is off (or the key is missing) every function is a no-op, so this is safe
 * to ship dark and flip per-environment.
 *
 * Triggering uses the REST API directly (proven against the 3.17 self-hosted
 * instance) rather than an SDK, to avoid SDK/server version drift.
 */

import crypto from "node:crypto";
import { logger } from "@/lib/logger";

const API_URL = (process.env.NOVU_API_URL || "https://novu-api.roadsidega.com").replace(/\/$/, "");
const SECRET_KEY = process.env.NOVU_SECRET_KEY || "";

/** Master switch. Off by default — flip per environment once verified. */
export function isNovuEnabled(): boolean {
  return process.env.NOVU_ENABLED === "true" && SECRET_KEY.length > 0;
}

/**
 * PHASE 2 cutover switch. When true (and Novu enabled), Novu OWNS delivery of
 * email/SMS/push for the events it has workflows for — the legacy
 * Resend/Twilio/web-push senders for those specific events are skipped to avoid
 * double-sending. Requires the workflows' email/SMS steps to be active in Novu
 * (re-seed with CHANNELS_ACTIVE=true). Off by default → legacy keeps delivering
 * and Novu only adds the in-app Inbox. Events WITHOUT a Novu workflow (email
 * verification, password reset, B2B invoices, Checkr, onboarding steps, etc.)
 * are never gated by this and keep using the legacy senders.
 */
export function novuOwnsDelivery(): boolean {
  return isNovuEnabled() && process.env.NOVU_OWNS_DELIVERY === "true";
}

/** Topic that fans out to all admins/ops for a tenant (or global if no tenant). */
export function adminsTopic(tenantId?: string | null): string {
  return tenantId ? `admins:${tenantId}` : "admins";
}

/** Workflow trigger identifiers — must match scripts/seed-novu-workflows.mjs. */
export const WF = {
  bookingCreated: "booking-created",
  bookingConfirmed: "booking-confirmed",
  bookingDispatched: "booking-dispatched",
  etaUpdate: "eta-update",
  bookingInProgress: "booking-in-progress",
  bookingCompleted: "booking-completed",
  bookingCancelled: "booking-cancelled",
  bookingReminder: "booking-reminder",
  paymentLink: "payment-link",
  paymentConfirmed: "payment-confirmed",
  paymentFailed: "payment-failed",
  paymentRefunded: "payment-refunded",
  reviewRequest: "review-request",
  referralCredited: "referral-credited",
  loyaltyEarned: "loyalty-earned",
  membershipActivated: "membership-activated",
  membershipPastDue: "membership-past-due",
  membershipCanceled: "membership-canceled",
  dispatchOffer: "dispatch-offer",
  providerJobAssigned: "provider-job-assigned",
  providerApplicationReceived: "provider-application-received",
  providerResubmissionRequested: "provider-resubmission-requested",
  providerApproved: "provider-approved",
  providerRejected: "provider-rejected",
  providerSuspended: "provider-suspended",
  payoutPaid: "payout-paid",
  payoutHeld: "payout-held",
  payoutClawback: "payout-clawback",
  reviewReceived: "review-received",
  opsNewBooking: "ops-new-booking",
  opsPaymentDisputed: "ops-payment-disputed",
  opsDispatchNoProvider: "ops-dispatch-no-provider",
  opsSlaBreach: "ops-sla-breach",
  opsLowRating: "ops-low-rating",
  opsRecurringMaterialized: "ops-recurring-materialized",
} as const;

/** Map a booking status to its customer-facing workflow id. */
export function bookingStatusWorkflow(status: string): string | null {
  switch (status) {
    case "confirmed": return WF.bookingConfirmed;
    case "dispatched": return WF.bookingDispatched;
    case "in_progress": return WF.bookingInProgress;
    case "completed": return WF.bookingCompleted;
    case "cancelled": return WF.bookingCancelled;
    default: return null;
  }
}

/** Format integer cents as a display string, e.g. 12000 -> "$120.00". */
export function money(cents?: number | null): string {
  if (cents == null || Number.isNaN(cents)) return "";
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Subscriber-id convention. Customers are keyed by their users.id; providers by
 * `provider:<providerId>` (provider.id is reliably in scope at provider
 * notification sites, the provider's userId often is not). The front-end Inbox
 * must use the matching id for the logged-in role (see inbox-bell.tsx).
 */
export const custSub = (userId: string): string => userId;
export const provSub = (providerId: string): string => `provider:${providerId}`;

type Recipient =
  | string // subscriberId
  | { subscriberId: string; email?: string | null; phone?: string | null; firstName?: string | null }
  | { type: "Topic"; topicKey: string };

async function novuFetch(path: string, body: unknown): Promise<Response> {
  return fetch(`${API_URL}/v1${path}`, {
    method: "POST",
    headers: { Authorization: `ApiKey ${SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Has a notification already been delivered for this transactionId? Self-hosted
 * Novu does NOT treat transactionId as an idempotency key, so we enforce it
 * ourselves: the activity feed is queryable by transactionId. Best-effort — on
 * any error we return false so a real notification is never suppressed by a
 * transient lookup failure. (Catches retries seconds+ apart; truly simultaneous
 * double-calls are already prevented upstream by the webhook/transition guards.)
 */
async function alreadyTriggered(transactionId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_URL}/v1/notifications?transactionId=${encodeURIComponent(transactionId)}&page=0`,
      { headers: { Authorization: `ApiKey ${SECRET_KEY}` } },
    );
    if (!res.ok) return false;
    const body = await res.json();
    return Array.isArray(body?.data) && body.data.length > 0;
  } catch {
    return false;
  }
}

/**
 * Fire a Novu workflow. Never throws — failures are logged and swallowed so a
 * notification problem can never break a booking/payment flow. No-op when
 * Novu is disabled. When a stable `transactionId` (e.g. `${bookingId}:dispatched`)
 * is passed, the call is idempotent: if a notification already exists for that
 * id it is skipped, so a duplicate event can't double-send.
 */
export async function triggerNovu(
  workflowId: string,
  to: Recipient,
  payload: Record<string, unknown> = {},
  opts: { transactionId?: string; tenant?: string | null } = {},
): Promise<void> {
  if (!isNovuEnabled()) return;
  try {
    if (opts.transactionId && (await alreadyTriggered(opts.transactionId))) {
      return; // idempotent: already delivered for this transaction
    }
    const res = await novuFetch("/events/trigger", {
      name: workflowId,
      to,
      payload,
      ...(opts.transactionId ? { transactionId: opts.transactionId } : {}),
      ...(opts.tenant ? { tenant: opts.tenant } : {}),
    });
    if (!res.ok) {
      logger.warn("novu trigger failed", { workflowId, status: res.status, body: (await res.text()).slice(0, 200) });
    }
  } catch (err) {
    logger.warn("novu trigger error", { workflowId, error: (err as Error).message });
  }
}

/** Upsert a Novu subscriber. No-op when disabled; never throws. */
export async function syncSubscriber(sub: {
  subscriberId: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  data?: Record<string, unknown>;
}): Promise<void> {
  if (!isNovuEnabled()) return;
  try {
    const res = await novuFetch("/subscribers", {
      subscriberId: sub.subscriberId,
      email: sub.email ?? undefined,
      phone: sub.phone ?? undefined,
      firstName: sub.firstName ?? undefined,
      lastName: sub.lastName ?? undefined,
      data: sub.data ?? undefined,
    });
    if (!res.ok) {
      logger.warn("novu subscriber sync failed", { subscriberId: sub.subscriberId, status: res.status });
    }
  } catch (err) {
    logger.warn("novu subscriber sync error", { subscriberId: sub.subscriberId, error: (err as Error).message });
  }
}

/**
 * HMAC hash that authenticates a subscriber to the front-end <Inbox> component
 * (prevents a user from reading another subscriber's feed). Returns null when
 * Novu is disabled. See components/notifications/inbox-bell.tsx.
 */
export function inboxSubscriberHash(subscriberId: string): string | null {
  if (!SECRET_KEY) return null;
  return crypto.createHmac("sha256", SECRET_KEY).update(subscriberId).digest("hex");
}

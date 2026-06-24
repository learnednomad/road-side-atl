/**
 * Analytics event catalog — the single source of truth for every PostHog event
 * name emitted by RoadSide GA (web + server).
 *
 * Conventions (keep consistent — see [[project_posthog_analytics]]):
 * - Event names: snake_case verbs/outcomes (e.g. `booking_created`, `payment_succeeded`).
 * - Property keys: snake_case. IDs always included (`booking_id`, `provider_id`, ...).
 * - Money in integer cents. Commission rates in basis points.
 * - Server events go through `captureServer()` (lib/posthog-server.ts).
 * - Client events use `posthog.capture(ANALYTICS_EVENTS.X, {...})`.
 *
 * Page views and generic clicks are intentionally NOT listed here — PostHog
 * autocapture + `$pageview` already cover them. This catalog is for business /
 * lifecycle / funnel events that autocapture cannot see or structure.
 */
export const ANALYTICS_EVENTS = {
  // --- Auth -----------------------------------------------------------------
  USER_SIGNED_UP: "user_signed_up", // client: registration form submitted
  USER_LOGGED_IN: "user_logged_in", // client: credentials/google sign-in
  USER_REGISTERED: "user_registered", // server: customer account persisted
  EMAIL_VERIFIED: "email_verified", // server: email verification consumed
  PASSWORD_RESET_COMPLETED: "password_reset_completed", // server: password reset

  // --- Booking lifecycle ----------------------------------------------------
  BOOKING_SUBMITTED: "booking_submitted", // client: booking form submit
  BOOKING_CREATED: "booking_created", // server: booking persisted
  BOOKING_RESCHEDULED: "booking_rescheduled", // server: scheduledAt changed
  BOOKING_CANCELLED: "booking_cancelled", // server: booking cancelled
  BOOKING_CONFIRMATION_VIEWED: "booking_confirmation_viewed", // server: confirmation page
  QUOTE_APPROVED: "quote_approved", // server: customer approved quote
  QUOTE_DECLINED: "quote_declined", // server: customer declined quote

  // --- Booking funnel (client, structured) ----------------------------------
  BOOKING_SERVICE_SELECTED: "booking_service_selected",
  BOOKING_STEP_COMPLETED: "booking_step_completed",
  BOOKING_PAYMENT_METHOD_SELECTED: "booking_payment_method_selected",
  BOOKING_REFERRAL_CREDIT_APPLIED: "booking_referral_credit_applied",
  QUOTE_APPROVAL_SUBMITTED: "quote_approval_submitted", // client: approve/reject from tracking

  // --- Payments (Stripe webhooks) -------------------------------------------
  PAYMENT_CHECKOUT_SESSION_CREATED: "payment_checkout_session_created",
  PAYMENT_SUCCEEDED: "payment_succeeded", // checkout.session.completed
  PAYMENT_FAILED: "payment_failed", // payment_intent.payment_failed
  CHECKOUT_ABANDONED: "checkout_abandoned", // checkout.session.expired
  PAYMENT_REFUNDED: "payment_refunded", // charge.refunded
  PAYMENT_DISPUTE_CREATED: "payment_dispute_created", // charge.dispute.created
  PAYMENT_DISPUTE_RESOLVED: "payment_dispute_resolved", // charge.dispute.updated (won/lost)

  // --- Payouts (provider transfers) -----------------------------------------
  PAYOUT_PAID: "payout_paid", // transfer.paid / admin mark-paid
  PAYOUT_FAILED: "payout_failed", // transfer.failed

  // --- Memberships ----------------------------------------------------------
  MEMBERSHIP_CHECKOUT_STARTED: "membership_checkout_started", // client
  MEMBERSHIP_CHECKOUT_CREATED: "membership_checkout_created", // server: session created
  MEMBERSHIP_ACTIVATED: "membership_activated", // subscription created/renewed
  MEMBERSHIP_CANCELED: "membership_canceled", // subscription deleted

  // --- Job / dispatch lifecycle (provider) ----------------------------------
  JOB_ACCEPTED: "job_accepted",
  JOB_REJECTED: "job_rejected",
  JOB_STARTED: "job_started",
  JOB_COMPLETED: "job_completed",

  // --- Provider onboarding --------------------------------------------------
  PROVIDER_REGISTRATION_SUBMITTED: "provider_registration_submitted", // client form
  PROVIDER_APPLICATION_SUBMITTED: "provider_application_submitted", // server apply/register
  PROVIDER_INVITE_ACCEPTED: "provider_invite_accepted",
  PROVIDER_DOCUMENTS_SUBMITTED: "provider_documents_submitted",
  PROVIDER_BACKGROUND_CHECK_COMPLETED: "provider_background_check_completed", // checkr webhook
  PROVIDER_STRIPE_CONNECT_COMPLETED: "provider_stripe_connect_completed", // account.updated
  PROVIDER_IDENTITY_VERIFIED: "provider_identity_verified", // identity webhook
  PROVIDER_IC_AGREEMENT_ACCEPTED: "provider_ic_agreement_accepted",
  PROVIDER_ACTIVATED: "provider_activated", // admin approval
  PROVIDER_REJECTED: "provider_rejected", // admin rejection
  PROVIDER_SUSPENDED: "provider_suspended", // admin suspension

  // --- Engagement -----------------------------------------------------------
  REVIEW_SUBMITTED: "review_submitted",
  REFERRAL_APPLIED: "referral_applied",
  REFERRAL_REDEEMED: "referral_redeemed",
} as const;

/** Union of all valid analytics event names. */
export type AnalyticsEvent =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

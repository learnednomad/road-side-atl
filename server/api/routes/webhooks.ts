import { Hono } from "hono";
import crypto from "crypto";
import { db } from "@/db";
import { payments, bookings, providerPayouts } from "@/db/schema";
import { onboardingSteps } from "@/db/schema/onboarding-steps";
import { providers } from "@/db/schema/providers";
import { eq, and, sql } from "drizzle-orm";
// sql used for JSONB merge in transfer webhooks
import { stripe } from "@/lib/stripe";
import { createPayoutIfEligible } from "../lib/payout-calculator";
import { demoteTrustTier } from "../lib/trust-tier";
import { logAudit } from "../lib/audit-logger";
import { isValidStepTransition } from "../lib/onboarding-state-machine";
import { broadcastToUser, broadcastToAdmins } from "@/server/websocket/broadcast";
import { notifyBackgroundCheckResult, notifyStripeConnectCompleted } from "@/lib/notifications";
import { checkAllStepsCompleteAndTransition, onStripeConnectStepComplete } from "../lib/all-steps-complete";

const app = new Hono();

// ── Helpers ──────────────────────────────────────────────────────

/**
 * In-memory set for event ID deduplication within a single process lifecycle.
 * Stripe retries webhooks on non-2xx responses — this prevents processing the same event twice.
 * For multi-instance deployments, replace with a DB table or Redis set.
 */
const processedStripeEvents = new Set<string>();
const processedCheckrEvents = new Set<string>();
const MAX_PROCESSED_EVENTS = 10000;

function markEventProcessed(eventId: string, source: "stripe" | "checkr" = "stripe") {
  const set = source === "stripe" ? processedStripeEvents : processedCheckrEvents;
  set.add(eventId);
  // Prevent unbounded memory growth — evict oldest entries
  if (set.size > MAX_PROCESSED_EVENTS) {
    const first = set.values().next().value;
    if (first) set.delete(first);
  }
}

function isEventProcessed(eventId: string, source: "stripe" | "checkr" = "stripe"): boolean {
  const set = source === "stripe" ? processedStripeEvents : processedCheckrEvents;
  return set.has(eventId);
}

/**
 * Extract PaymentIntent ID from Stripe event objects.
 * Stripe sometimes returns the full object, sometimes just the string ID.
 */
function extractPaymentIntentId(pi: string | { id: string } | null | undefined): string | null {
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

/**
 * Find a payment record by PaymentIntent ID (primary) or bookingId from metadata (fallback).
 * The fallback handles payments created before we started storing stripePaymentIntentId.
 */
async function findPayment(
  paymentIntentId: string | null,
  metadata: Record<string, string> | null | undefined,
  eventType: string
) {
  // Primary lookup: by PaymentIntent ID
  if (paymentIntentId) {
    const payment = await db.query.payments.findFirst({
      where: eq(payments.stripePaymentIntentId, paymentIntentId),
    });
    if (payment) return payment;
  }

  // Fallback: by bookingId from metadata (for charges/disputes that carry payment_intent_data.metadata)
  const bookingId = metadata?.bookingId;
  if (bookingId) {
    const payment = await db.query.payments.findFirst({
      where: and(eq(payments.bookingId, bookingId), eq(payments.method, "stripe")),
    });
    if (payment) return payment;
  }

  console.warn(`[Webhook] ${eventType}: no payment found (pi=${paymentIntentId}, bookingId=${bookingId || "none"})`);
  return null;
}

// ── Webhook Handler ──────────────────────────────────────────────

app.post("/stripe", async (c) => {
  const body = await c.req.text();
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    return c.json({ error: "Missing signature" }, 400);
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[Webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return c.json({ error: "Webhook not configured" }, 500);
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return c.json({ error: "Invalid signature" }, 400);
  }

  // Event-level idempotency: skip already-processed events
  if (isEventProcessed(event.id, "stripe")) {
    return c.json({ received: true, deduplicated: true });
  }

  switch (event.type) {
    // ── Payment Confirmed ──────────────────────────────────────
    case "checkout.session.completed": {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId;
      const paymentIntentId = extractPaymentIntentId(session.payment_intent);
      const isDestinationCharge = session.metadata?.chargeType === "destination";

      if (bookingId && session.id) {
        // Idempotency: skip if already confirmed
        const existing = await db.query.payments.findFirst({
          where: and(eq(payments.stripeSessionId, session.id), eq(payments.status, "confirmed")),
        });
        if (existing) break;

        // For destination charges, retrieve the PaymentIntent to capture the transfer ID
        let stripeTransferId: string | null = null;
        if (isDestinationCharge && paymentIntentId) {
          try {
            const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
              expand: ["latest_charge.transfer"],
            });
            const charge = pi.latest_charge;
            if (charge && typeof charge === "object" && "transfer" in charge) {
              const transfer = charge.transfer;
              stripeTransferId = typeof transfer === "string" ? transfer : transfer?.id ?? null;
            }
          } catch (err) {
            console.error("[Webhook] Failed to retrieve transfer ID for destination charge:", err);
          }
        }

        // Confirm payment and store PaymentIntent ID + transfer ID for cross-referencing
        await db
          .update(payments)
          .set({
            status: "confirmed",
            confirmedAt: new Date(),
            ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
            ...(stripeTransferId ? { stripeTransferId } : {}),
          })
          .where(eq(payments.stripeSessionId, session.id));

        if (session.amount_total) {
          await db
            .update(bookings)
            .set({ finalPrice: session.amount_total, updatedAt: new Date() })
            .where(eq(bookings.id, bookingId));
        }

        await createPayoutIfEligible(bookingId);
      }
      break;
    }

    // ── Checkout Expired (customer abandoned) ───────────────────
    case "checkout.session.expired": {
      const session = event.data.object;
      if (session.id) {
        // Only update if still pending (idempotent)
        await db
          .update(payments)
          .set({ status: "failed" })
          .where(and(eq(payments.stripeSessionId, session.id), eq(payments.status, "pending")));
      }
      break;
    }

    // ── Refund Processed ────────────────────────────────────────
    case "charge.refunded": {
      const charge = event.data.object;
      const paymentIntentId = extractPaymentIntentId(charge.payment_intent);
      const payment = await findPayment(paymentIntentId, charge.metadata, "charge.refunded");

      if (payment && payment.status !== "refunded") {
        // Determine if full or partial refund
        const refundedAmount = charge.amount_refunded || 0;
        await db
          .update(payments)
          .set({
            status: "refunded",
            refundAmount: refundedAmount > 0 ? refundedAmount : payment.amount,
            refundedAt: new Date(),
          })
          .where(eq(payments.id, payment.id));
      }
      break;
    }

    // ── Payment Failed (card declined, 3DS failed, etc.) ────────
    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object;
      const failureMessage = paymentIntent.last_payment_error?.message || "Unknown failure";
      const failureCode = paymentIntent.last_payment_error?.code;

      logAudit({
        action: "payment.confirm",
        resourceType: "payment_intent",
        resourceId: paymentIntent.id,
        details: {
          status: "failed",
          failureMessage,
          failureCode: failureCode || null,
          bookingId: paymentIntent.metadata?.bookingId || null,
        },
      });

      const payment = await findPayment(paymentIntent.id, paymentIntent.metadata, "payment_intent.payment_failed");
      if (payment && payment.status === "pending") {
        await db
          .update(payments)
          .set({ status: "failed" })
          .where(eq(payments.id, payment.id));
      }
      break;
    }

    // ── Dispute Opened ──────────────────────────────────────────
    case "charge.dispute.created": {
      const dispute = event.data.object;
      const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
      const paymentIntentId = extractPaymentIntentId(dispute.payment_intent);

      logAudit({
        action: "payment.dispute",
        resourceType: "dispute",
        resourceId: dispute.id,
        details: {
          reason: dispute.reason,
          amount: dispute.amount,
          currency: dispute.currency,
          status: dispute.status,
          chargeId: chargeId || null,
          paymentIntentId: paymentIntentId || null,
        },
      });

      const payment = await findPayment(paymentIntentId, dispute.metadata, "charge.dispute.created");
      if (payment) {
        await db
          .update(payments)
          .set({ status: "disputed" })
          .where(eq(payments.id, payment.id));

        await db
          .update(bookings)
          .set({
            notes: `[DISPUTE] ${dispute.reason} — Dispute ID: ${dispute.id}`,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, payment.bookingId));

        // Freeze any pending payout for this booking
        await db
          .update(providerPayouts)
          .set({
            status: "held",
            holdReason: `Dispute: ${dispute.reason} (${dispute.id})`,
            heldAt: new Date(),
          })
          .where(
            and(
              eq(providerPayouts.bookingId, payment.bookingId),
              eq(providerPayouts.status, "pending"),
            ),
          );

        // Auto-demote customer trust tier on dispute
        const booking = await db.query.bookings.findFirst({
          where: eq(bookings.id, payment.bookingId),
          columns: { userId: true },
        });
        if (booking?.userId) {
          demoteTrustTier(booking.userId, `Dispute: ${dispute.reason} (${dispute.id})`).catch((err) => {
            console.error("[TrustTier] Demotion failed:", err);
          });
        }
      }
      break;
    }

    // ── Dispute Resolution ──────────────────────────────────────
    case "charge.dispute.updated": {
      const dispute = event.data.object;
      const paymentIntentId = extractPaymentIntentId(dispute.payment_intent);

      logAudit({
        action: "payment.dispute",
        resourceType: "dispute",
        resourceId: dispute.id,
        details: {
          reason: dispute.reason,
          amount: dispute.amount,
          status: dispute.status,
          paymentIntentId: paymentIntentId || null,
        },
      });

      const payment = await findPayment(paymentIntentId, dispute.metadata, "charge.dispute.updated");
      if (payment) {
        if (dispute.status === "won") {
          await db
            .update(payments)
            .set({ status: "confirmed" })
            .where(eq(payments.id, payment.id));

          await db
            .update(bookings)
            .set({
              notes: `[DISPUTE WON] Resolved in our favor — Dispute ID: ${dispute.id}`,
              updatedAt: new Date(),
            })
            .where(eq(bookings.id, payment.bookingId));

          // Release held payouts — transition back to pending for processing
          await db
            .update(providerPayouts)
            .set({
              status: "pending",
              holdReason: null,
              heldAt: null,
            })
            .where(
              and(
                eq(providerPayouts.bookingId, payment.bookingId),
                eq(providerPayouts.status, "held"),
              ),
            );
        }

        if (dispute.status === "lost") {
          // Create clawback for any already-paid payouts
          const paidPayout = await db.query.providerPayouts.findFirst({
            where: and(
              eq(providerPayouts.bookingId, payment.bookingId),
              eq(providerPayouts.status, "paid"),
              sql`${providerPayouts.payoutType} = 'standard'`,
            ),
          });

          if (paidPayout) {
            await db.insert(providerPayouts).values({
              providerId: paidPayout.providerId,
              bookingId: payment.bookingId,
              amount: -paidPayout.amount,
              status: "pending",
              payoutType: "clawback",
              originalPayoutId: paidPayout.id,
              paymentId: payment.id,
              notes: `Clawback: dispute lost (${dispute.id})`,
              payoutMethod: paidPayout.payoutMethod,
            });
          }

          // Cancel any held payouts
          await db
            .update(providerPayouts)
            .set({
              status: "clawback",
              holdReason: `Dispute lost: ${dispute.reason}`,
            })
            .where(
              and(
                eq(providerPayouts.bookingId, payment.bookingId),
                eq(providerPayouts.status, "held"),
              ),
            );

          await db
            .update(payments)
            .set({
              status: "refunded",
              refundAmount: dispute.amount,
              refundedAt: new Date(),
              refundReason: `Dispute lost: ${dispute.reason}`,
            })
            .where(eq(payments.id, payment.id));
        }
      }
      break;
    }

    // ── Dispute Funds Withdrawn (funds debited from your Stripe balance) ──
    case "charge.dispute.funds_withdrawn": {
      const dispute = event.data.object;
      const paymentIntentId = extractPaymentIntentId(dispute.payment_intent);

      logAudit({
        action: "payment.dispute",
        resourceType: "dispute",
        resourceId: dispute.id,
        details: {
          event: "funds_withdrawn",
          amount: dispute.amount,
          currency: dispute.currency,
          paymentIntentId: paymentIntentId || null,
        },
      });
      break;
    }

    // ── Dispute Funds Reinstated (funds returned after winning dispute) ──
    case "charge.dispute.funds_reinstated": {
      const dispute = event.data.object;
      const paymentIntentId = extractPaymentIntentId(dispute.payment_intent);

      logAudit({
        action: "payment.dispute",
        resourceType: "dispute",
        resourceId: dispute.id,
        details: {
          event: "funds_reinstated",
          amount: dispute.amount,
          currency: dispute.currency,
          paymentIntentId: paymentIntentId || null,
        },
      });

      // Restore payment status since funds are back
      const payment = await findPayment(paymentIntentId, dispute.metadata, "charge.dispute.funds_reinstated");
      if (payment && payment.status === "disputed") {
        await db
          .update(payments)
          .set({ status: "confirmed" })
          .where(eq(payments.id, payment.id));
      }
      break;
    }

    // ── Connect Account Updated (Stripe Connect onboarding) ─────
    case "account.updated": {
      const account = event.data.object as { id: string; charges_enabled?: boolean; details_submitted?: boolean };
      if (!account.charges_enabled) break; // Only care about enabled

      const connectedProvider = await db.query.providers.findFirst({
        where: eq(providers.stripeConnectAccountId, account.id),
      });
      if (!connectedProvider) break; // Orphan event

      // Find stripe_connect step
      const stripeStep = await db.query.onboardingSteps.findFirst({
        where: and(
          eq(onboardingSteps.providerId, connectedProvider.id),
          eq(onboardingSteps.stepType, "stripe_connect"),
        ),
      });
      if (!stripeStep) break;

      if (isValidStepTransition(stripeStep.status, "complete")) {
        // Transition in_progress → complete (TOCTOU guard on expected status)
        const [updatedStep] = await db
          .update(onboardingSteps)
          .set({
            status: "complete",
            completedAt: new Date(),
            metadata: {
              ...(stripeStep.metadata as Record<string, unknown> || {}),
              chargesEnabledAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(onboardingSteps.id, stripeStep.id),
              eq(onboardingSteps.status, stripeStep.status),
            ),
          )
          .returning();

        if (updatedStep) {
          logAudit({
            action: "stripe_connect.onboarding_completed",
            resourceType: "onboarding_step",
            resourceId: stripeStep.id,
            details: {
              providerId: connectedProvider.id,
              stripeAccountId: account.id,
              source: "webhook",
            },
          });

          // Broadcast to provider
          if (connectedProvider.userId) {
            broadcastToUser(connectedProvider.userId, {
              type: "onboarding:step_updated",
              data: {
                providerId: connectedProvider.id,
                stepType: "stripe_connect",
                newStatus: "complete",
              },
            });
          }

          notifyStripeConnectCompleted(connectedProvider.id).catch((err) => {
            console.error("[Notifications] Failed:", err);
          });

          // All-steps-complete auto-transition check
          await checkAllStepsCompleteAndTransition(
            connectedProvider.id, stripeStep.id, "stripe_connect_webhook",
            undefined, connectedProvider,
          );

          // Auto-migrate pending payouts + reactivate if suspended
          onStripeConnectStepComplete(connectedProvider.id).catch((err) => {
            console.error("[Webhook] onStripeConnectStepComplete failed:", err);
          });
        }
      }
      break;
    }

    // ── Transfer Paid (Stripe Connect payout succeeded) ─────────
    case "transfer.paid" as string: {
      const transfer = event.data.object as unknown as { id: string; metadata?: Record<string, string>; amount?: number; destination?: string };
      const payoutId = transfer.metadata?.payoutId;

      if (payoutId) {
        // Update payout metadata with transfer confirmation
        await db
          .update(providerPayouts)
          .set({
            metadata: sql`coalesce(${providerPayouts.metadata}, '{}'::jsonb) || ${JSON.stringify({ transferPaidAt: new Date().toISOString() })}::jsonb`,
          })
          .where(eq(providerPayouts.id, payoutId));

        // Find provider for notification
        const payout = await db.query.providerPayouts.findFirst({
          where: eq(providerPayouts.id, payoutId),
        });
        if (payout) {
          const { notifyPayoutComplete } = await import("@/lib/notifications");
          notifyPayoutComplete(payout.providerId, payout.amount).catch((err) => {
            console.error("[Notifications] Failed:", err);
          });
        }

        logAudit({
          action: "payout.transfer_confirmed",
          resourceType: "payout",
          resourceId: payoutId,
          details: { stripeTransferId: transfer.id, amount: transfer.amount },
        });
      }
      break;
    }

    // ── Transfer Failed (Stripe Connect payout failed) ──────────
    case "transfer.failed" as string: {
      const transfer = event.data.object as unknown as { id: string; metadata?: Record<string, string>; amount?: number; destination?: string };
      const payoutId = transfer.metadata?.payoutId;

      if (payoutId) {
        // Revert to manual batch — only if currently paid via stripe_connect (status guard)
        const [reverted] = await db
          .update(providerPayouts)
          .set({
            status: "pending",
            paidAt: null,
            payoutMethod: "manual_batch",
            metadata: sql`coalesce(${providerPayouts.metadata}, '{}'::jsonb) || ${JSON.stringify({ transferFailedAt: new Date().toISOString(), failedTransferId: transfer.id })}::jsonb`,
          })
          .where(
            and(
              eq(providerPayouts.id, payoutId),
              eq(providerPayouts.status, "paid"),
              eq(providerPayouts.payoutMethod, "stripe_connect"),
            ),
          )
          .returning();

        if (!reverted) break; // Already handled or manually confirmed — skip

        logAudit({
          action: "payout.transfer_failed",
          resourceType: "payout",
          resourceId: payoutId,
          details: { stripeTransferId: transfer.id, amount: transfer.amount },
        });

        // Notify admin
        broadcastToAdmins({
          type: "payout:transfer_failed",
          data: { payoutId, stripeTransferId: transfer.id },
        });
      }
      break;
    }

    // ── Stripe Identity Verification ─────────────────────────────
    case "identity.verification_session.verified" as string: {
      const session = event.data.object as unknown as {
        id: string;
        metadata?: Record<string, string>;
        verified_outputs?: { first_name?: string; last_name?: string; dob?: { year: number; month: number; day: number } };
      };
      const stepId = session.metadata?.stepId;
      const providerId = session.metadata?.providerId;

      if (stepId && providerId) {
        const step = await db.query.onboardingSteps.findFirst({
          where: eq(onboardingSteps.id, stepId),
        });

        if (step && isValidStepTransition(step.status, "complete")) {
          const existingMeta = (step.metadata || {}) as Record<string, unknown>;
          await db
            .update(onboardingSteps)
            .set({
              status: "complete",
              completedAt: new Date(),
              metadata: {
                ...existingMeta,
                verifiedName: session.verified_outputs?.first_name
                  ? `${session.verified_outputs.first_name} ${session.verified_outputs.last_name || ""}`
                  : undefined,
                verifiedAt: new Date().toISOString(),
              },
              updatedAt: new Date(),
            })
            .where(eq(onboardingSteps.id, stepId));

          logAudit({
            action: "onboarding.status_changed",
            resourceType: "onboarding_step",
            resourceId: stepId,
            details: { stepType: "identity_verification", newStatus: "complete", sessionId: session.id },
          });

          await checkAllStepsCompleteAndTransition(providerId, stepId, "identity_webhook");
        }
      }
      break;
    }

    case "identity.verification_session.requires_input" as string: {
      const session = event.data.object as unknown as {
        id: string;
        metadata?: Record<string, string>;
        last_error?: { code: string; reason: string };
      };
      const stepId = session.metadata?.stepId;

      if (stepId) {
        const existingStep = await db.query.onboardingSteps.findFirst({
          where: eq(onboardingSteps.id, stepId),
        });
        const existingMeta = (existingStep?.metadata || {}) as Record<string, unknown>;

        await db
          .update(onboardingSteps)
          .set({
            metadata: {
              ...existingMeta,
              lastError: session.last_error?.code || "requires_input",
              lastErrorReason: session.last_error?.reason,
            },
            updatedAt: new Date(),
          })
          .where(eq(onboardingSteps.id, stepId));
      }
      break;
    }

    // ── Catch-all for unhandled events ───────────────────────────
    default:
      // Log unhandled events at debug level — don't fail
      break;
  }

  markEventProcessed(event.id, "stripe");
  return c.json({ received: true });
});

// ── Checkr Webhook Handler ───────────────────────────────────────

function validateCheckrSignature(payload: string, signature: string): boolean {
  const secret = process.env.CHECKR_WEBHOOK_SECRET;
  if (!secret) return false;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const expected = hmac.digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

import { CHECKR_STATUS_MAP } from "@/lib/constants";

app.post("/checkr", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("x-checkr-signature");

  if (!signature || !validateCheckrSignature(rawBody, signature)) {
    logAudit({
      action: "checkr.webhook_invalid_signature",
      details: { hasSignature: !!signature },
    });
    return c.json({ error: "Invalid signature" }, 401);
  }

  let event: { id: string; type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  // Event-level idempotency
  if (isEventProcessed(event.id, "checkr")) {
    return c.json({ ok: true }, 200);
  }
  markEventProcessed(event.id, "checkr");

  if (event.type === "report.completed") {
    const reportData = event.data.object;
    const reportId = reportData.id as string;
    const candidateId = reportData.candidate_id as string;
    const checkrStatus = reportData.status as string;
    const adjudication = reportData.adjudication as string | null;

    // Find matching onboarding step by checkrCandidateId in metadata JSONB
    // (checkrReportId is null until this webhook backfills it)
    const matchingSteps = await db
      .select()
      .from(onboardingSteps)
      .where(
        and(
          eq(onboardingSteps.stepType, "background_check"),
          sql`${onboardingSteps.metadata}->>'checkrCandidateId' = ${candidateId}`,
        ),
      )
      .limit(1);

    if (!matchingSteps.length) {
      return c.json({ ok: true }, 200);
    }

    const step = matchingSteps[0]!;
    const effectiveStatus = adjudication || checkrStatus;
    const newStepStatus = CHECKR_STATUS_MAP[effectiveStatus] || "in_progress";

    // Backfill real report ID in step metadata (was null until this webhook)
    const existingMetadata = (step.metadata || {}) as Record<string, unknown>;
    await db
      .update(onboardingSteps)
      .set({
        metadata: { ...existingMetadata, checkrReportId: reportId },
        updatedAt: new Date(),
      })
      .where(eq(onboardingSteps.id, step.id));

    if (isValidStepTransition(step.status, newStepStatus)) {
      await db
        .update(onboardingSteps)
        .set({
          status: newStepStatus as typeof step.status,
          completedAt: newStepStatus === "complete" ? new Date() : null,
          rejectionReason:
            newStepStatus === "rejected"
              ? `Background check result: ${effectiveStatus}`
              : null,
          updatedAt: new Date(),
        })
        .where(and(eq(onboardingSteps.id, step.id), eq(onboardingSteps.status, step.status)));
    }

    logAudit({
      action: "checkr.report_received",
      resourceType: "onboarding_step",
      resourceId: step.id,
      details: {
        checkrStatus,
        adjudication,
        reportId,
        providerId: step.providerId,
        newStepStatus,
      },
    });

    // Broadcast to provider
    const provider = await db.query.providers.findFirst({
      where: eq(providers.id, step.providerId),
    });

    if (provider?.userId) {
      broadcastToUser(provider.userId, {
        type: "onboarding:step_updated",
        data: {
          providerId: step.providerId,
          stepType: "background_check",
          newStatus: newStepStatus,
        },
      });

      // Fire-and-forget notification
      notifyBackgroundCheckResult(step.providerId, effectiveStatus).catch((err) => {
        console.error("[Notifications] Failed:", err);
      });
    }

    // Broadcast to admins for consider (pending_review)
    if (newStepStatus === "pending_review") {
      broadcastToAdmins({
        type: "onboarding:step_updated",
        data: {
          providerId: step.providerId,
          stepType: "background_check",
          newStatus: "pending_review",
        },
      });
    }

    // All-steps-complete auto-transition check
    if (newStepStatus === "complete") {
      await checkAllStepsCompleteAndTransition(
        step.providerId, step.id, "checkr_webhook",
        undefined, provider,
      );
    }
  }

  return c.json({ ok: true }, 200);
});

export default app;

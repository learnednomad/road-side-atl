import { Hono } from "hono";
import { db } from "@/db";
import { payments, bookings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { createPayoutIfEligible } from "../lib/payout-calculator";
import { logAudit } from "../lib/audit-logger";

const app = new Hono();

// ── Helpers ──────────────────────────────────────────────────────

/**
 * In-memory set for event ID deduplication within a single process lifecycle.
 * Stripe retries webhooks on non-2xx responses — this prevents processing the same event twice.
 * For multi-instance deployments, replace with a DB table or Redis set.
 */
const processedEvents = new Set<string>();
const MAX_PROCESSED_EVENTS = 10000;

function markEventProcessed(eventId: string) {
  processedEvents.add(eventId);
  // Prevent unbounded memory growth — evict oldest entries
  if (processedEvents.size > MAX_PROCESSED_EVENTS) {
    const first = processedEvents.values().next().value;
    if (first) processedEvents.delete(first);
  }
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
  if (processedEvents.has(event.id)) {
    return c.json({ received: true, deduplicated: true });
  }

  switch (event.type) {
    // ── Payment Confirmed ──────────────────────────────────────
    case "checkout.session.completed": {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId;
      const paymentIntentId = extractPaymentIntentId(session.payment_intent);

      if (bookingId && session.id) {
        // Idempotency: skip if already confirmed
        const existing = await db.query.payments.findFirst({
          where: and(eq(payments.stripeSessionId, session.id), eq(payments.status, "confirmed")),
        });
        if (existing) break;

        // Confirm payment and store PaymentIntent ID for future cross-referencing
        await db
          .update(payments)
          .set({
            status: "confirmed",
            confirmedAt: new Date(),
            ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
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
        }

        if (dispute.status === "lost") {
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

    // ── Catch-all for unhandled events ───────────────────────────
    default:
      // Log unhandled events at debug level — don't fail
      break;
  }

  markEventProcessed(event.id);
  return c.json({ received: true });
});

export default app;

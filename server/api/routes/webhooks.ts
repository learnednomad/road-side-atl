import { Hono } from "hono";
import { db } from "@/db";
import { payments, bookings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { createPayoutIfEligible } from "../lib/payout-calculator";
import { logAudit } from "../lib/audit-logger";

const app = new Hono();

app.post("/stripe", async (c) => {
  const body = await c.req.text();
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    return c.json({ error: "Missing signature" }, 400);
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return c.json({ error: "Invalid signature" }, 400);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId;

      if (bookingId && session.id) {
        await db
          .update(payments)
          .set({
            status: "confirmed",
            confirmedAt: new Date(),
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

    case "charge.refunded": {
      const charge = event.data.object;
      const paymentIntentId = charge.payment_intent;

      if (paymentIntentId) {
        const bookingId = charge.metadata?.bookingId;
        if (bookingId) {
          await db
            .update(payments)
            .set({ status: "refunded" })
            .where(eq(payments.bookingId, bookingId));
        }
      }
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object;

      if (session.id) {
        await db
          .update(payments)
          .set({ status: "failed" })
          .where(eq(payments.stripeSessionId, session.id));
      }
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object;
      const bookingId = dispute.metadata?.bookingId;
      const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;

      logAudit({
        action: "payment.refund",
        resourceType: "dispute",
        resourceId: dispute.id,
        details: {
          reason: dispute.reason,
          amount: dispute.amount,
          currency: dispute.currency,
          status: dispute.status,
          bookingId: bookingId || null,
          chargeId: chargeId || null,
        },
      });

      // Mark the associated payment as disputed if we can find it
      if (bookingId) {
        await db
          .update(payments)
          .set({ status: "failed" })
          .where(eq(payments.bookingId, bookingId));

        await db
          .update(bookings)
          .set({ notes: `[DISPUTE] ${dispute.reason} — Dispute ID: ${dispute.id}`, updatedAt: new Date() })
          .where(eq(bookings.id, bookingId));
      }
      break;
    }

    case "charge.dispute.updated": {
      const dispute = event.data.object;
      const bookingId = dispute.metadata?.bookingId;

      logAudit({
        action: "payment.refund",
        resourceType: "dispute",
        resourceId: dispute.id,
        details: {
          reason: dispute.reason,
          amount: dispute.amount,
          status: dispute.status,
          bookingId: bookingId || null,
        },
      });

      // If dispute is won, restore the payment
      if (dispute.status === "won" && bookingId) {
        await db
          .update(payments)
          .set({ status: "confirmed" })
          .where(eq(payments.bookingId, bookingId));
      }

      // If dispute is lost, mark as refunded
      if (dispute.status === "lost" && bookingId) {
        await db
          .update(payments)
          .set({
            status: "refunded",
            refundAmount: dispute.amount,
            refundedAt: new Date(),
            refundReason: `Dispute lost: ${dispute.reason}`,
          })
          .where(eq(payments.bookingId, bookingId));
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object;
      const bookingId = paymentIntent.metadata?.bookingId;
      const failureMessage = paymentIntent.last_payment_error?.message || "Unknown failure";

      logAudit({
        action: "payment.confirm",
        resourceType: "payment_intent",
        resourceId: paymentIntent.id,
        details: {
          status: "failed",
          failureMessage,
          bookingId: bookingId || null,
        },
      });

      if (bookingId) {
        // Mark associated payment as failed
        await db
          .update(payments)
          .set({ status: "failed" })
          .where(eq(payments.bookingId, bookingId));
      }
      break;
    }
  }

  return c.json({ received: true });
});

export default app;

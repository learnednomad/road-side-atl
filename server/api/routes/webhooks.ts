import { Hono } from "hono";
import { db } from "@/db";
import { payments, bookings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { createPayoutIfEligible } from "../lib/payout-calculator";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;

    if (bookingId && session.id) {
      // Update payment status
      await db
        .update(payments)
        .set({
          status: "confirmed",
          confirmedAt: new Date(),
        })
        .where(eq(payments.stripeSessionId, session.id));

      // Update booking finalPrice from session amount
      if (session.amount_total) {
        await db
          .update(bookings)
          .set({ finalPrice: session.amount_total, updatedAt: new Date() })
          .where(eq(bookings.id, bookingId));
      }

      // Try to create payout if booking is already completed
      await createPayoutIfEligible(bookingId);
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    const paymentIntentId = charge.payment_intent;

    // Find payment by stripe session and update to refunded
    if (paymentIntentId) {
      // Update any payment associated with this charge's metadata
      const bookingId = charge.metadata?.bookingId;
      if (bookingId) {
        await db
          .update(payments)
          .set({ status: "refunded" })
          .where(eq(payments.bookingId, bookingId));
      }
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object;

    if (session.id) {
      await db
        .update(payments)
        .set({ status: "failed" })
        .where(eq(payments.stripeSessionId, session.id));
    }
  }

  return c.json({ received: true });
});

export default app;

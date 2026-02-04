import { Hono } from "hono";
import { db } from "@/db";
import { bookings, payments, services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { createStripeCheckoutSchema } from "@/lib/validators";

const app = new Hono();

// Create Stripe checkout session
app.post("/stripe/checkout", async (c) => {
  const body = await c.req.json();
  const parsed = createStripeCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input" }, 400);
  }

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, parsed.data.bookingId),
  });
  if (!booking) {
    return c.json({ error: "Booking not found" }, 404);
  }

  const service = await db.query.services.findFirst({
    where: eq(services.id, booking.serviceId),
  });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: service?.name || "Roadside Service",
            description: `Booking #${booking.id.slice(0, 8)}`,
          },
          unit_amount: booking.estimatedPrice,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${c.req.header("origin") || process.env.AUTH_URL}/book/confirmation?bookingId=${booking.id}&paid=true`,
    cancel_url: `${c.req.header("origin") || process.env.AUTH_URL}/book/confirmation?bookingId=${booking.id}`,
    metadata: {
      bookingId: booking.id,
    },
  });

  // Create pending payment record
  await db.insert(payments).values({
    bookingId: booking.id,
    amount: booking.estimatedPrice,
    method: "stripe",
    status: "pending",
    stripeSessionId: session.id,
  });

  return c.json({ url: session.url });
});

export default app;

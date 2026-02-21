import { Hono } from "hono";
import { db } from "@/db";
import { bookings, payments, services, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { createStripeCheckoutSchema, isPaymentMethodAllowedForTier } from "@/lib/validators";
import { requireAuth } from "@/server/api/middleware/auth";
import { validatePaymentMethod } from "@/server/api/middleware/trust-tier";
import { rateLimitStrict } from "@/server/api/middleware/rate-limit";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/stripe/*", rateLimitStrict);
app.use("/stripe/*", requireAuth);
app.use("/stripe/*", validatePaymentMethod);

// Create Stripe checkout session
app.post("/stripe/checkout", async (c) => {
  const body = await c.req.json();
  const parsed = createStripeCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input" }, 400);
  }

  const user = c.get("user");

  // Layer 2: Defense-in-depth — independent trust tier check inside handler
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { trustTier: true },
  });
  if (!dbUser || !isPaymentMethodAllowedForTier("stripe", dbUser.trustTier)) {
    return c.json({ error: "Payment method not allowed for your trust tier" }, 400);
  }

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, parsed.data.bookingId),
  });
  if (!booking) {
    return c.json({ error: "Booking not found" }, 404);
  }

  // Verify booking ownership — allow if guest booking (null userId) or owned by authenticated user
  if (booking.userId && booking.userId !== user.id) {
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

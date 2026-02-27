import { Hono } from "hono";
import Stripe from "stripe";
import { db } from "@/db";
import { bookings, payments, services, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { stripe, getStripe } from "@/lib/stripe";
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

/**
 * Get or create a Stripe Customer for the authenticated user.
 * Stores the Stripe customer ID in the users table for reuse.
 */
async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, stripeCustomerId: true, name: true, email: true, phone: true },
  });

  if (!dbUser) throw new Error("User not found");

  // Return existing Stripe Customer ID if we have one
  if (dbUser.stripeCustomerId) {
    return dbUser.stripeCustomerId;
  }

  // Create new Stripe Customer
  const customer = await getStripe().customers.create({
    name: dbUser.name || undefined,
    email: dbUser.email || undefined,
    phone: dbUser.phone || undefined,
    metadata: {
      userId: dbUser.id,
    },
  });

  // Store for future use
  await db
    .update(users)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return customer.id;
}

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

  // Idempotency: prevent duplicate checkout sessions for same booking
  const existingPending = await db.query.payments.findFirst({
    where: and(eq(payments.bookingId, parsed.data.bookingId), eq(payments.status, "pending")),
  });
  if (existingPending?.stripeSessionId) {
    const existingSession = await stripe.checkout.sessions.retrieve(existingPending.stripeSessionId);
    if (existingSession.status === "open" && existingSession.url) {
      return c.json({ url: existingSession.url });
    }
  }

  const service = await db.query.services.findFirst({
    where: eq(services.id, booking.serviceId),
  });

  const baseUrl = process.env.AUTH_URL;
  if (!baseUrl) {
    return c.json({ error: "Server misconfiguration" }, 500);
  }

  // Create or retrieve Stripe Customer for authenticated user
  const stripeCustomerId = await getOrCreateStripeCustomer(user.id);

  // Build line item — use linked Stripe Product if available, otherwise inline product_data
  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = {
    price_data: {
      currency: "usd",
      unit_amount: booking.estimatedPrice,
      ...(service?.stripeProductId
        ? { product: service.stripeProductId }
        : {
            product_data: {
              name: service?.name || "Roadside Service",
              description: `Booking #${booking.id.slice(0, 8)}`,
            },
          }),
    },
    quantity: 1,
  };

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [lineItem],
    mode: "payment",
    customer: stripeCustomerId,
    success_url: `${baseUrl}/book/confirmation?bookingId=${booking.id}&paid=true`,
    cancel_url: `${baseUrl}/book/confirmation?bookingId=${booking.id}`,
    // Session-level metadata (available on checkout.session.completed)
    metadata: {
      bookingId: booking.id,
      serviceSlug: service?.slug || "unknown",
      userId: user.id,
    },
    // PaymentIntent-level metadata (available on charge.refunded, dispute, payment_failed events)
    payment_intent_data: {
      metadata: {
        bookingId: booking.id,
        serviceSlug: service?.slug || "unknown",
        userId: user.id,
      },
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

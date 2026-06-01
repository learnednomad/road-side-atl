import { Hono } from "hono";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";
import { requireAuth } from "@/server/api/middleware/auth";
import { rateLimitStrict } from "@/server/api/middleware/rate-limit";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/server/api/lib/feature-flags";
import { logger } from "@/lib/logger";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", rateLimitStrict);
app.use("/*", requireAuth);

/**
 * Get or create Stripe Customer ID for authenticated user.
 */
async function ensureStripeCustomer(userId: string): Promise<string> {
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, stripeCustomerId: true, name: true, email: true, phone: true },
  });
  if (!dbUser) throw new Error("User not found");

  if (dbUser.stripeCustomerId) return dbUser.stripeCustomerId;

  const customer = await getStripe().customers.create({
    name: dbUser.name || undefined,
    email: dbUser.email || undefined,
    phone: dbUser.phone || undefined,
    metadata: { userId: dbUser.id },
  });

  await db
    .update(users)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return customer.id;
}

// POST /payment-methods/setup-intent — create SetupIntent for saving a card
app.post("/setup-intent", async (c) => {
  const user = c.get("user");
  const customerId = await ensureStripeCustomer(user.id);

  const setupIntent = await getStripe().setupIntents.create({
    customer: customerId,
    automatic_payment_methods: { enabled: true },
    metadata: { userId: user.id },
  });

  return c.json({ clientSecret: setupIntent.client_secret });
});

// GET /payment-methods — list saved payment methods
app.get("/", async (c) => {
  const user = c.get("user");
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { stripeCustomerId: true, defaultPaymentMethodId: true },
  });

  if (!dbUser?.stripeCustomerId) {
    return c.json({ methods: [], defaultMethodId: null });
  }

  const methods = await getStripe().paymentMethods.list({
    customer: dbUser.stripeCustomerId,
    type: "card",
  });

  return c.json({
    methods: methods.data.map((m) => ({
      id: m.id,
      brand: m.card?.brand,
      last4: m.card?.last4,
      expMonth: m.card?.exp_month,
      expYear: m.card?.exp_year,
      isDefault: m.id === dbUser.defaultPaymentMethodId,
    })),
    defaultMethodId: dbUser.defaultPaymentMethodId,
  });
});

// DELETE /payment-methods/:id — detach a saved payment method
app.delete("/:id", async (c) => {
  const user = c.get("user");
  const methodId = c.req.param("id");

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { stripeCustomerId: true, defaultPaymentMethodId: true },
  });

  if (!dbUser?.stripeCustomerId) {
    return c.json({ error: "No payment methods" }, 404);
  }

  // Verify the method belongs to this customer
  const method = await getStripe().paymentMethods.retrieve(methodId);
  if (method.customer !== dbUser.stripeCustomerId) {
    return c.json({ error: "Not found" }, 404);
  }

  await getStripe().paymentMethods.detach(methodId);

  // Clear default if this was the default method
  if (dbUser.defaultPaymentMethodId === methodId) {
    await db
      .update(users)
      .set({ defaultPaymentMethodId: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  return c.json({ ok: true });
});

// PUT /payment-methods/default — set default payment method
app.put("/default", async (c) => {
  const user = c.get("user");
  const { methodId } = await c.req.json<{ methodId: string }>();

  if (!methodId) {
    return c.json({ error: "methodId required" }, 400);
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { stripeCustomerId: true },
  });

  if (!dbUser?.stripeCustomerId) {
    return c.json({ error: "No Stripe customer" }, 400);
  }

  // Verify ownership
  const method = await getStripe().paymentMethods.retrieve(methodId);
  if (method.customer !== dbUser.stripeCustomerId) {
    return c.json({ error: "Not found" }, 404);
  }

  await db
    .update(users)
    .set({ defaultPaymentMethodId: methodId, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  // Also set as default on Stripe customer
  await getStripe().customers.update(dbUser.stripeCustomerId, {
    invoice_settings: { default_payment_method: methodId },
  });

  return c.json({ ok: true, defaultMethodId: methodId });
});

// ── Customer Identity Verification (high-value transactions) ─────

const IDENTITY_THRESHOLD_CENTS = 50000; // $500

// POST /payment-methods/identity/start — create VerificationSession for customer
app.post("/identity/start", async (c) => {
  const user = c.get("user");

  if (!(await isFeatureEnabled(FEATURE_FLAGS.CUSTOMER_IDENTITY_VERIFICATION))) {
    return c.json({ error: "Customer identity verification not enabled" }, 400);
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { id: true, name: true, email: true },
  });
  if (!dbUser) return c.json({ error: "User not found" }, 404);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsidega.com";

  try {
    const session = await getStripe().identity.verificationSessions.create({
      type: "document",
      metadata: {
        userId: user.id,
        purpose: "high_value_transaction",
      },
      return_url: `${appUrl}/book/confirmation?identity=complete`,
    });

    return c.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    logger.error("[CustomerIdentity] Failed to create verification session:", { error: err instanceof Error ? err.message : String(err) });
    return c.json({ error: "Unable to start identity verification" }, 503);
  }
});

// GET /payment-methods/identity/status — check customer verification status
app.get("/identity/status", async (c) => {
  const user = c.get("user");
  const sessionId = c.req.query("sessionId");

  if (!sessionId) {
    return c.json({ error: "sessionId query param required" }, 400);
  }

  try {
    const session = await getStripe().identity.verificationSessions.retrieve(sessionId);

    // Verify it belongs to this user
    if (session.metadata?.userId !== user.id) {
      return c.json({ error: "Not found" }, 404);
    }

    return c.json({
      status: session.status,
      verified: session.status === "verified",
    });
  } catch {
    return c.json({ error: "Session not found" }, 404);
  }
});

/**
 * Check if a customer needs identity verification for a given amount.
 * Used by the checkout flow to gate high-value transactions.
 */
export async function requiresCustomerIdentity(amountCents: number): Promise<boolean> {
  if (amountCents < IDENTITY_THRESHOLD_CENTS) return false;
  return isFeatureEnabled(FEATURE_FLAGS.CUSTOMER_IDENTITY_VERIFICATION);
}

export { IDENTITY_THRESHOLD_CENTS };
export default app;

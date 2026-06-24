/**
 * Consumer memberships — browse plans, view your membership, and start a Stripe
 * subscription checkout. Lifecycle (status/period) is synced by the
 * customer.subscription.* webhook handlers (0c registry).
 */
import { Hono } from "hono";
import { db } from "@/db";
import { membershipPlans } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { stripe } from "@/lib/stripe";
import { membershipCheckoutSchema } from "@/lib/validators";
import { getActiveMembership } from "../lib/memberships";
import { captureServer } from "@/lib/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

type AuthEnv = { Variables: { user: { id: string; role: string; email?: string | null } } };
const app = new Hono<AuthEnv>();

// GET /plans — active membership plans (public)
app.get("/plans", async (c) => {
  const rows = await db
    .select()
    .from(membershipPlans)
    .where(eq(membershipPlans.active, true))
    .orderBy(desc(membershipPlans.createdAt));
  return c.json({ data: rows });
});

// GET /me — the authenticated user's active membership + plan
app.get("/me", requireAuth, async (c) => {
  const user = c.get("user");
  const m = await getActiveMembership(user.id);
  if (!m) return c.json({ membership: null });
  const plan = await db.query.membershipPlans.findFirst({ where: eq(membershipPlans.id, m.planId) });
  return c.json({ membership: m, plan });
});

// POST /checkout — start a Stripe subscription checkout for a plan
app.post("/checkout", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = membershipCheckoutSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);

  const plan = await db.query.membershipPlans.findFirst({
    where: and(eq(membershipPlans.id, parsed.data.planId), eq(membershipPlans.active, true)),
  });
  if (!plan) return c.json({ error: "Plan not found" }, 404);

  const baseUrl = process.env.AUTH_URL;
  if (!baseUrl) return c.json({ error: "Server misconfiguration" }, 500);
  if (await getActiveMembership(user.id)) return c.json({ error: "Already an active member" }, 400);

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    customer_email: user.email ?? undefined,
    success_url: `${baseUrl}/account/membership?joined=true`,
    cancel_url: `${baseUrl}/account/membership`,
    subscription_data: {
      metadata: { userId: user.id, planId: plan.id, discountBp: String(plan.discountBp) },
    },
    metadata: { kind: "membership", userId: user.id, planId: plan.id },
  });

  captureServer(ANALYTICS_EVENTS.MEMBERSHIP_CHECKOUT_CREATED, {
    distinctId: user.id,
    plan_id: plan.id,
    plan_name: plan.name,
    price_cents: plan.priceCents,
    interval: plan.interval,
    discount_bp: plan.discountBp,
  });

  return c.json({ url: checkout.url });
});

export default app;

import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "@/db";
import { promotions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";
import { requireAdmin } from "../middleware/auth";
import { rateLimitStandard } from "../middleware/rate-limit";
import { logAudit, getRequestInfo } from "../lib/audit-logger";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();
app.use("/*", rateLimitStandard);
app.use("/*", requireAdmin);

const createPromotionSchema = z.object({
  code: z.string().min(3).max(20).transform((v) => v.toUpperCase()),
  description: z.string().optional(),
  discountType: z.enum(["percent", "fixed"]),
  discountAmount: z.number().int().min(1), // percentage or cents
  maxRedemptions: z.number().int().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
});

// GET /admin/promotions — list all promotions
app.get("/", async (c) => {
  const all = await db.query.promotions.findMany({
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });
  return c.json({ promotions: all });
});

// POST /admin/promotions — create coupon + promotion code
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createPromotionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const user = c.get("user");
  const { code, description, discountType, discountAmount, maxRedemptions, expiresAt } = parsed.data;

  try {
    // Create Stripe Coupon
    const coupon = await getStripe().coupons.create({
      ...(discountType === "percent"
        ? { percent_off: discountAmount }
        : { amount_off: discountAmount, currency: "usd" }),
      duration: "once",
      name: `${code}${description ? ` - ${description}` : ""}`,
      max_redemptions: maxRedemptions ?? undefined,
      redeem_by: expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : undefined,
    });

    // Create Stripe Promotion Code (customer-facing code)
    const promoCode = await getStripe().promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },
      code,
      max_redemptions: maxRedemptions ?? undefined,
      ...(expiresAt ? { expires_at: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}),
    });

    // Store in DB
    const [promo] = await db
      .insert(promotions)
      .values({
        stripeCouponId: coupon.id,
        stripePromotionCodeId: promoCode.id,
        code,
        description: description ?? null,
        discountType,
        discountAmount,
        maxRedemptions: maxRedemptions ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    logAudit({
      action: "settings.update",
      userId: user.id,
      resourceType: "promotion",
      resourceId: promo!.id,
      details: { code, discountType, discountAmount, stripeCouponId: coupon.id },
      ...getRequestInfo(c.req.raw),
    });

    return c.json(promo, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to create promotion" }, 500);
  }
});

// DELETE /admin/promotions/:id — deactivate a promotion
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  const promo = await db.query.promotions.findFirst({
    where: eq(promotions.id, id),
  });
  if (!promo) return c.json({ error: "Not found" }, 404);

  // Deactivate on Stripe
  if (promo.stripePromotionCodeId) {
    await getStripe().promotionCodes.update(promo.stripePromotionCodeId, { active: false });
  }

  await db
    .update(promotions)
    .set({ active: false })
    .where(eq(promotions.id, id));

  logAudit({
    action: "settings.update",
    userId: user.id,
    resourceType: "promotion",
    resourceId: id,
    details: { action: "deactivated", code: promo.code },
    ...getRequestInfo(c.req.raw),
  });

  return c.json({ ok: true });
});

export default app;

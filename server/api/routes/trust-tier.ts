import { Hono } from "hono";
import { db } from "@/db";
import { users, platformSettings } from "@/db/schema";
import { eq, or, and, ilike, count, desc } from "drizzle-orm";
import { requireAdmin } from "@/server/api/middleware/auth";
import { rateLimitStandard } from "@/server/api/middleware/rate-limit";
import { trustTierUpdateSchema, updatePromotionThresholdSchema } from "@/lib/validators";
import { logAudit, getRequestInfo } from "@/server/api/lib/audit-logger";
import { TRUST_TIER_PROMOTION_THRESHOLD } from "@/lib/constants";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireAdmin);
app.use("/*", rateLimitStandard);

// GET / — List customers with tier info, search, pagination
app.get("/", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "20") || 20, 1), 100);
  const search = c.req.query("search") || "";
  const offset = (page - 1) * limit;

  const whereFilter = search
    ? and(
        eq(users.role, "customer"),
        or(
          ilike(users.name, `%${search}%`),
          ilike(users.email, `%${search}%`)
        )
      )
    : eq(users.role, "customer");

  const [totalResult] = await db
    .select({ count: count() })
    .from(users)
    .where(whereFilter);

  const customerData = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      trustTier: users.trustTier,
      cleanTransactionCount: users.cleanTransactionCount,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(whereFilter)
    .orderBy(desc(users.cleanTransactionCount))
    .limit(limit)
    .offset(offset);

  const total = totalResult.count;
  const totalPages = Math.ceil(total / limit);

  return c.json({ data: customerData, total, page, totalPages });
});

// GET /config — Return current promotion threshold
app.get("/config", async (c) => {
  const setting = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.key, "trust_tier_promotion_threshold"),
  });

  const promotionThreshold = setting
    ? parseInt(setting.value, 10)
    : TRUST_TIER_PROMOTION_THRESHOLD;

  return c.json({ promotionThreshold });
});

// PATCH /config — Update promotion threshold
app.patch("/config", async (c) => {
  const body = await c.req.json();
  const parsed = updatePromotionThresholdSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const existing = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.key, "trust_tier_promotion_threshold"),
  });

  const previousValue = existing
    ? existing.value
    : String(TRUST_TIER_PROMOTION_THRESHOLD);

  if (previousValue === String(parsed.data.promotionThreshold)) {
    return c.json({ promotionThreshold: parsed.data.promotionThreshold });
  }

  if (existing) {
    await db
      .update(platformSettings)
      .set({
        value: String(parsed.data.promotionThreshold),
        updatedAt: new Date(),
      })
      .where(eq(platformSettings.key, "trust_tier_promotion_threshold"));
  } else {
    await db.insert(platformSettings).values({
      key: "trust_tier_promotion_threshold",
      value: String(parsed.data.promotionThreshold),
    });
  }

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  logAudit({
    action: "settings.update",
    userId: user.id,
    resourceType: "platform_settings",
    resourceId: "trust_tier_promotion_threshold",
    details: {
      key: "trust_tier_promotion_threshold",
      previousValue,
      newValue: String(parsed.data.promotionThreshold),
    },
    ipAddress,
    userAgent,
  });

  return c.json({ promotionThreshold: parsed.data.promotionThreshold });
});

// PATCH /:userId — Manual promote/demote
app.patch("/:userId", async (c) => {
  const userId = c.req.param("userId");
  const body = await c.req.json();
  const parsed = trustTierUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      name: true,
      email: true,
      role: true,
      trustTier: true,
      cleanTransactionCount: true,
    },
  });

  if (!existing) {
    return c.json({ error: "User not found" }, 404);
  }

  if (existing.role !== "customer") {
    return c.json({ error: "Only customers can have trust tiers modified" }, 400);
  }

  if (existing.trustTier === parsed.data.trustTier) {
    return c.json({ error: "User is already at this tier" }, 400);
  }

  const [updated] = await db
    .update(users)
    .set({
      trustTier: parsed.data.trustTier,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), eq(users.trustTier, existing.trustTier)))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      trustTier: users.trustTier,
      cleanTransactionCount: users.cleanTransactionCount,
      role: users.role,
      createdAt: users.createdAt,
    });

  if (!updated) {
    return c.json({ error: "Tier was modified concurrently, please refresh and try again" }, 409);
  }

  const admin = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  logAudit({
    action: "trust_tier.admin_override",
    userId: admin.id,
    resourceType: "user",
    resourceId: userId,
    details: {
      previousTier: existing.trustTier,
      newTier: parsed.data.trustTier,
      reason: "admin_manual",
      customerName: existing.name,
      customerEmail: existing.email,
    },
    ipAddress,
    userAgent,
  });

  return c.json(updated);
});

export default app;

import { Hono } from "hono";
import { db } from "@/db";
import { referrals, users } from "@/db/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { createReferralSchema, redeemCreditsSchema, providerReferralSchema } from "@/lib/validators";
import { logAudit, getRequestInfo } from "../lib/audit-logger";
import { REFERRAL_CREDIT_AMOUNT_CENTS } from "@/lib/constants";
import { generateReferralCode, calculateCreditBalance, redeemReferralCredits } from "../lib/referral-credits";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

// Get current user's referral info
app.get("/me", requireAuth, async (c) => {
  const user = c.get("user");

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  if (!dbUser) {
    return c.json({ error: "User not found" }, 404);
  }

  let referralCode = dbUser.referralCode;
  if (!referralCode) {
    referralCode = await generateReferralCode(user.id);
  }

  const [{ count: totalReferrals }] = await db
    .select({ count: count() })
    .from(referrals)
    .where(eq(referrals.referrerId, user.id));

  const [{ count: creditedReferrals }] = await db
    .select({ count: count() })
    .from(referrals)
    .where(and(eq(referrals.referrerId, user.id), eq(referrals.status, "credited")));

  const creditBalance = await calculateCreditBalance(user.id);

  const referralLink = `${process.env.NEXT_PUBLIC_APP_URL || ""}/register?ref=${referralCode}`;

  return c.json({
    referralCode,
    referralLink,
    totalReferrals,
    creditedReferrals,
    creditBalance,
  });
});

// List user's referrals (paginated)
app.get("/", requireAuth, async (c) => {
  const user = c.get("user");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const status = c.req.query("status");
  const offset = (page - 1) * limit;

  const conditions = [eq(referrals.referrerId, user.id)];
  if (status === "pending" || status === "credited" || status === "expired") {
    conditions.push(eq(referrals.status, status));
  }

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const userReferrals = await db
    .select({
      id: referrals.id,
      refereeId: referrals.refereeId,
      bookingId: referrals.bookingId,
      creditAmount: referrals.creditAmount,
      status: referrals.status,
      createdAt: referrals.createdAt,
      refereeName: users.name,
    })
    .from(referrals)
    .leftJoin(users, eq(referrals.refereeId, users.id))
    .where(whereClause)
    .orderBy(desc(referrals.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(referrals)
    .where(whereClause);

  return c.json({
    data: userReferrals,
    total: Number(total),
    page,
    limit,
    totalPages: Math.ceil(Number(total) / limit),
  });
});

// Validate a referral code (used during signup)
app.post("/validate", async (c) => {
  const body = await c.req.json();
  const parsed = createReferralSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const { referralCode } = parsed.data;

  const referrer = await db.query.users.findFirst({
    where: eq(users.referralCode, referralCode),
  });

  if (!referrer) {
    return c.json({ valid: false });
  }

  return c.json({ valid: true, referrerName: referrer.name });
});

// Apply referral code to current user (called after first booking completion)
app.post("/apply", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = createReferralSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const { referralCode } = parsed.data;

  const referrer = await db.query.users.findFirst({
    where: eq(users.referralCode, referralCode),
  });

  if (!referrer) {
    return c.json({ error: "Invalid referral code" }, 400);
  }

  if (referrer.id === user.id) {
    return c.json({ error: "Cannot refer yourself" }, 400);
  }

  // Check if user already has a referral (prevent double referral)
  const existingReferral = await db.query.referrals.findFirst({
    where: eq(referrals.refereeId, user.id),
  });

  if (existingReferral) {
    return c.json({ error: "Referral already applied" }, 400);
  }

  const [newReferral] = await db
    .insert(referrals)
    .values({
      referrerId: referrer.id,
      refereeId: user.id,
      creditAmount: REFERRAL_CREDIT_AMOUNT_CENTS,
      status: "pending",
    })
    .returning();

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  logAudit({
    action: "referral.create",
    userId: user.id,
    resourceType: "referral",
    resourceId: newReferral.id,
    details: { referrerId: referrer.id, referralCode },
    ipAddress,
    userAgent,
  });

  return c.json({ referral: newReferral }, 201);
});

// Get available credit balance
app.get("/me/balance", requireAuth, async (c) => {
  const user = c.get("user");
  const balance = await calculateCreditBalance(user.id);
  return c.json({ balance });
});

// Redeem credits on a booking
app.post("/redeem", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = redeemCreditsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const { bookingId, amount } = parsed.data;

  const success = await redeemReferralCredits(user.id, bookingId, amount);
  if (!success) {
    return c.json({ error: "Insufficient credit balance or booking not found" }, 400);
  }

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "referral.credit",
    userId: user.id,
    resourceType: "booking",
    resourceId: bookingId,
    details: { amount, type: "redemption" },
    ipAddress,
    userAgent,
  });

  return c.json({ success: true, amountApplied: amount });
});

// Provider refers another provider
app.post("/provider-refer", requireAuth, async (c) => {
  const user = c.get("user");

  if (user.role !== "provider") {
    return c.json({ error: "Provider access required" }, 403);
  }

  const body = await c.req.json();
  const parsed = providerReferralSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  // Check if referee email already has an account
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.refereeEmail),
  });

  if (existingUser) {
    // Check for duplicate referral
    const existingReferral = await db.query.referrals.findFirst({
      where: eq(referrals.refereeId, existingUser.id),
    });
    if (existingReferral) {
      return c.json({ error: "This user has already been referred" }, 400);
    }
  }

  const [newReferral] = await db
    .insert(referrals)
    .values({
      referrerId: user.id,
      refereeId: existingUser?.id || null,
      creditAmount: REFERRAL_CREDIT_AMOUNT_CENTS,
      status: "pending",
    })
    .returning();

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "referral.create",
    userId: user.id,
    resourceType: "referral",
    resourceId: newReferral.id,
    details: { refereeEmail: parsed.data.refereeEmail, type: "provider_referral" },
    ipAddress,
    userAgent,
  });

  return c.json({ referral: newReferral }, 201);
});

// List provider's referrals
app.get("/provider", requireAuth, async (c) => {
  const user = c.get("user");

  if (user.role !== "provider") {
    return c.json({ error: "Provider access required" }, 403);
  }

  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = (page - 1) * limit;

  const providerReferrals = await db
    .select({
      id: referrals.id,
      refereeId: referrals.refereeId,
      creditAmount: referrals.creditAmount,
      status: referrals.status,
      createdAt: referrals.createdAt,
      refereeName: users.name,
    })
    .from(referrals)
    .leftJoin(users, eq(referrals.refereeId, users.id))
    .where(eq(referrals.referrerId, user.id))
    .orderBy(desc(referrals.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(referrals)
    .where(eq(referrals.referrerId, user.id));

  return c.json({
    referrals: providerReferrals,
    total,
    page,
    limit,
    hasMore: offset + limit < Number(total),
  });
});

export default app;

import { db } from "@/db";
import { referrals, bookings, users, providers, providerPayouts } from "@/db/schema";
import { providerInviteTokens } from "@/db/schema/auth";
import { eq, and, sql } from "drizzle-orm";
import { REFERRAL_CREDIT_AMOUNT_CENTS, PROVIDER_REFERRAL_REWARD_CENTS } from "@/lib/constants";
import { logAudit } from "./audit-logger";
import { notifyReferralCredit } from "@/lib/notifications";

/**
 * Apply referral credit when a referee completes their first booking.
 * Both referrer and referee receive REFERRAL_CREDIT_AMOUNT_CENTS.
 */
export async function applyReferralCredit(referralId: string): Promise<boolean> {
  const referral = await db.query.referrals.findFirst({
    where: eq(referrals.id, referralId),
  });

  if (!referral || referral.status !== "pending") return false;

  const [updated] = await db
    .update(referrals)
    .set({ status: "credited" })
    .where(eq(referrals.id, referralId))
    .returning();

  if (!updated) return false;

  logAudit({
    action: "referral.credit",
    userId: referral.referrerId,
    resourceType: "referral",
    resourceId: referralId,
    details: { refereeId: referral.refereeId, creditAmount: REFERRAL_CREDIT_AMOUNT_CENTS },
  });

  return true;
}

/**
 * Generate a short unique referral code and persist it to the user record.
 * Retries up to 3 times on unique constraint collision.
 */
export async function generateReferralCode(userId?: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    if (!userId) return code;
    try {
      await db
        .update(users)
        .set({ referralCode: code, updatedAt: new Date() })
        .where(eq(users.id, userId));
      return code;
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
  // Unreachable, but satisfies TypeScript
  throw new Error("Failed to generate referral code");
}

/**
 * Calculate available credit balance for a user.
 * Total credited referrals (as referrer + as referee) minus redeemed credits.
 */
export async function calculateCreditBalance(userId: string): Promise<number> {
  const [referrerCredits] = await db
    .select({ total: sql<number>`COALESCE(SUM(${referrals.creditAmount}), 0)` })
    .from(referrals)
    .where(and(eq(referrals.referrerId, userId), eq(referrals.status, "credited")));

  const [refereeCredits] = await db
    .select({ total: sql<number>`COALESCE(SUM(${referrals.creditAmount}), 0)` })
    .from(referrals)
    .where(and(eq(referrals.refereeId, userId), eq(referrals.status, "credited")));

  const totalEarned = Number(referrerCredits.total) + Number(refereeCredits.total);

  const [redeemed] = await db
    .select({ total: sql<number>`COALESCE(SUM(${bookings.referralCreditApplied}), 0)` })
    .from(bookings)
    .where(eq(bookings.userId, userId));

  return totalEarned - Number(redeemed.total);
}

/**
 * Redeem referral credits on a booking.
 */
export async function redeemReferralCredits(
  userId: string,
  bookingId: string,
  amount: number
): Promise<boolean> {
  const balance = await calculateCreditBalance(userId);
  if (balance < amount) return false;

  const [updated] = await db
    .update(bookings)
    .set({ referralCreditApplied: amount, updatedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId)))
    .returning();

  return !!updated;
}

/**
 * Credit a referral when the referee completes their first booking.
 */
export async function creditReferralOnFirstBooking(
  userId: string,
  bookingId: string
): Promise<void> {
  const pendingReferral = await db.query.referrals.findFirst({
    where: and(eq(referrals.refereeId, userId), eq(referrals.status, "pending")),
  });

  if (!pendingReferral) return;

  const [updated] = await db
    .update(referrals)
    .set({ status: "credited", bookingId })
    .where(eq(referrals.id, pendingReferral.id))
    .returning();

  if (!updated) return;

  logAudit({
    action: "referral.credit",
    userId: pendingReferral.referrerId,
    resourceType: "referral",
    resourceId: pendingReferral.id,
    details: { refereeId: userId, bookingId, creditAmount: REFERRAL_CREDIT_AMOUNT_CENTS },
  });

  // Notify referrer and referee (fire-and-forget)
  const referrer = await db.query.users.findFirst({ where: eq(users.id, pendingReferral.referrerId) });
  const referee = await db.query.users.findFirst({ where: eq(users.id, userId) });

  if (referrer?.phone) {
    notifyReferralCredit(referrer.phone, REFERRAL_CREDIT_AMOUNT_CENTS, referrer.email ?? undefined, referrer.name ?? undefined).catch((err) => { console.error("[Notifications] Failed:", err); });
  }
  if (referee?.phone) {
    notifyReferralCredit(referee.phone, REFERRAL_CREDIT_AMOUNT_CENTS, referee.email ?? undefined, referee.name ?? undefined).catch((err) => { console.error("[Notifications] Failed:", err); });
  }
}

/**
 * When a provider completes their first job, check if they were referred.
 * If so, credit the referring provider with $50 via a payout record.
 */
export async function creditProviderReferralOnFirstJob(
  providerId: string,
  bookingId: string,
): Promise<void> {
  // Find accepted referral invite for this provider
  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, providerId),
  });
  if (!provider?.email) return;

  const invite = await db.query.providerInviteTokens.findFirst({
    where: and(
      eq(providerInviteTokens.identifier, provider.email),
      eq(providerInviteTokens.inviteType, "referral"),
      eq(providerInviteTokens.status, "accepted"),
    ),
  });
  if (!invite?.referringProviderId) return;

  // Check if referral reward already credited (prevent double-credit)
  const existingPayout = await db.query.providerPayouts.findFirst({
    where: and(
      eq(providerPayouts.providerId, invite.referringProviderId),
      eq(providerPayouts.payoutType, "referral"),
      eq(providerPayouts.notes, `referral:${provider.email}`),
    ),
  });
  if (existingPayout) return;

  // Create payout for referring provider
  await db.insert(providerPayouts).values({
    providerId: invite.referringProviderId,
    bookingId,
    amount: PROVIDER_REFERRAL_REWARD_CENTS,
    payoutType: "referral",
    notes: `referral:${provider.email}`,
  });

  // Update referral status
  const referringProvider = await db.query.providers.findFirst({
    where: eq(providers.id, invite.referringProviderId),
  });
  if (referringProvider?.userId) {
    const pendingReferral = await db.query.referrals.findFirst({
      where: and(
        eq(referrals.referrerId, referringProvider.userId),
        eq(referrals.status, "pending"),
        eq(referrals.creditAmount, PROVIDER_REFERRAL_REWARD_CENTS),
      ),
    });
    if (pendingReferral) {
      await db.update(referrals)
        .set({ status: "credited", bookingId })
        .where(eq(referrals.id, pendingReferral.id));
    }
  }

  logAudit({
    action: "referral.credit",
    resourceType: "provider",
    resourceId: providerId,
    details: {
      referringProviderId: invite.referringProviderId,
      bookingId,
      rewardCents: PROVIDER_REFERRAL_REWARD_CENTS,
      type: "provider_referral",
    },
  });
}

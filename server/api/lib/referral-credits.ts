import { db } from "@/db";
import { referrals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { REFERRAL_CREDIT_AMOUNT_CENTS } from "@/lib/constants";
import { logAudit } from "./audit-logger";

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
 * Generate a short unique referral code.
 */
export function generateReferralCode(): string {
  return crypto.randomUUID().slice(0, 8).toUpperCase();
}

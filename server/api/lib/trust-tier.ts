import { db } from "@/db";
import { users, platformSettings } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { logAudit } from "@/server/api/lib/audit-logger";
import { TRUST_TIER_PROMOTION_THRESHOLD } from "@/lib/constants";

export const TIER_1_ALLOWED_METHODS = ["cash", "cashapp", "zelle"] as const;
export const TIER_2_ALLOWED_METHODS = ["cash", "cashapp", "zelle", "stripe"] as const;

export function getAllowedPaymentMethods(trustTier: number): readonly string[] {
  return trustTier >= 2 ? TIER_2_ALLOWED_METHODS : TIER_1_ALLOWED_METHODS;
}

/**
 * Read promotion threshold from platform_settings table.
 * Falls back to TRUST_TIER_PROMOTION_THRESHOLD constant if no DB row exists.
 */
export async function getPromotionThreshold(): Promise<number> {
  const setting = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.key, "trust_tier_promotion_threshold"),
  });
  return setting ? parseInt(setting.value, 10) : TRUST_TIER_PROMOTION_THRESHOLD;
}

/**
 * Increment clean transaction count and auto-promote if threshold met.
 * Uses atomic SQL increment to prevent race conditions.
 */
export async function incrementCleanTransaction(userId: string): Promise<{
  promoted: boolean;
  newTier: number;
  newCount: number;
}> {
  // Atomic increment — no read-then-write race condition
  const [updated] = await db
    .update(users)
    .set({
      cleanTransactionCount: sql`${users.cleanTransactionCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      trustTier: users.trustTier,
      cleanTransactionCount: users.cleanTransactionCount,
    });

  if (!updated) {
    return { promoted: false, newTier: 1, newCount: 0 };
  }

  // Promote atomically: only if still Tier 1 and threshold met
  const threshold = await getPromotionThreshold();
  if (
    updated.trustTier === 1 &&
    updated.cleanTransactionCount >= threshold
  ) {
    const [promoted] = await db
      .update(users)
      .set({ trustTier: 2, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.trustTier, 1)))
      .returning({ trustTier: users.trustTier });

    if (promoted && promoted.trustTier === 2) {
      logAudit({
        action: "trust_tier.promote",
        userId,
        resourceType: "user",
        resourceId: userId,
        details: {
          previousTier: 1,
          newTier: 2,
          reason: "auto_promotion",
          cleanTransactionCount: updated.cleanTransactionCount,
        },
      });

      return {
        promoted: true,
        newTier: 2,
        newCount: updated.cleanTransactionCount,
      };
    }
  }

  return {
    promoted: false,
    newTier: updated.trustTier,
    newCount: updated.cleanTransactionCount,
  };
}

/**
 * Check if user meets promotion threshold and promote if eligible.
 */
export async function checkAndPromote(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, trustTier: true, cleanTransactionCount: true },
  });

  if (!user || user.trustTier >= 2) {
    return false;
  }

  const threshold = await getPromotionThreshold();
  if (user.cleanTransactionCount >= threshold) {
    const [updated] = await db
      .update(users)
      .set({ trustTier: 2, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.trustTier, 1)))
      .returning({ trustTier: users.trustTier });

    if (!updated || updated.trustTier !== 2) {
      return false;
    }

    logAudit({
      action: "trust_tier.promote",
      userId,
      resourceType: "user",
      resourceId: userId,
      details: {
        previousTier: 1,
        newTier: updated.trustTier,
        reason: "auto_promotion",
        cleanTransactionCount: user.cleanTransactionCount,
      },
    });

    return true;
  }

  return false;
}

import { db } from "@/db";
import { users, platformSettings } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { logAudit } from "@/server/api/lib/audit-logger";
import { logger } from "@/lib/logger";
import { TRUST_TIER_PROMOTION_THRESHOLD, TIER_1_ALLOWED_METHODS, TIER_2_ALLOWED_METHODS } from "@/lib/constants";

export { TIER_1_ALLOWED_METHODS, TIER_2_ALLOWED_METHODS };

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

      (async () => {
        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { name: true, email: true, phone: true },
        });
        if (user?.email && user?.phone) {
          const { notifyTierPromotion } = await import("@/lib/notifications");
          notifyTierPromotion({
            name: user.name || "Customer",
            email: user.email,
            phone: user.phone,
          }).catch((err) => { console.error("[Notifications] Failed:", err); });
        }
      })().catch((err) => { console.error("[Error]", err); });

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

    (async () => {
      const fullUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { name: true, email: true, phone: true },
      });
      if (fullUser?.email && fullUser?.phone) {
        const { notifyTierPromotion } = await import("@/lib/notifications");
        notifyTierPromotion({
          name: fullUser.name || "Customer",
          email: fullUser.email,
          phone: fullUser.phone,
        }).catch((err) => { console.error("[Notifications] Failed:", err); });
      }
    })().catch((err) => { console.error("[Error]", err); });

    return true;
  }

  return false;
}

/**
 * Demote a user one trust tier (e.g., on dispute).
 * Minimum tier is 1 — cannot go below.
 */
export async function demoteTrustTier(userId: string, reason: string): Promise<{
  demoted: boolean;
  newTier: number;
}> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, trustTier: true },
  });

  if (!user || user.trustTier <= 1) {
    return { demoted: false, newTier: user?.trustTier ?? 1 };
  }

  const newTier = user.trustTier - 1;

  const [updated] = await db
    .update(users)
    .set({
      trustTier: newTier,
      trustTierUpdatedAt: new Date(),
      trustTierReason: reason,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), eq(users.trustTier, user.trustTier)))
    .returning({ trustTier: users.trustTier });

  if (!updated) {
    return { demoted: false, newTier: user.trustTier };
  }

  logAudit({
    action: "trust_tier.demote",
    userId,
    resourceType: "user",
    resourceId: userId,
    details: {
      previousTier: user.trustTier,
      newTier,
      reason,
    },
  });

  logger.info("[TrustTier] User demoted", { userId, previousTier: user.trustTier, newTier, reason });
  return { demoted: true, newTier };
}

/**
 * Batch evaluation: promote all eligible tier-1 users who have met the threshold.
 * Called by daily cron job.
 */
export async function evaluateTrustTierPromotions(): Promise<{
  evaluated: number;
  promoted: number;
}> {
  const threshold = await getPromotionThreshold();

  // Find all tier-1 users who have reached the threshold
  const eligible = await db
    .select({ id: users.id, cleanTransactionCount: users.cleanTransactionCount })
    .from(users)
    .where(
      and(
        eq(users.trustTier, 1),
        sql`${users.cleanTransactionCount} >= ${threshold}`,
      ),
    );

  let promoted = 0;
  for (const user of eligible) {
    const [updated] = await db
      .update(users)
      .set({
        trustTier: 2,
        trustTierUpdatedAt: new Date(),
        trustTierReason: "auto_promotion_batch",
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, user.id), eq(users.trustTier, 1)))
      .returning({ trustTier: users.trustTier });

    if (updated?.trustTier === 2) {
      logAudit({
        action: "trust_tier.promote",
        userId: user.id,
        resourceType: "user",
        resourceId: user.id,
        details: {
          previousTier: 1,
          newTier: 2,
          reason: "auto_promotion_batch",
          cleanTransactionCount: user.cleanTransactionCount,
        },
      });
      promoted++;
    }
  }

  logger.info("[TrustTier] Batch evaluation complete", { evaluated: eligible.length, promoted });
  return { evaluated: eligible.length, promoted };
}

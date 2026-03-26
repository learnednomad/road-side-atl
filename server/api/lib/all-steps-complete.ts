/**
 * Shared helper for the all-steps-complete auto-transition pattern.
 * When a step completes, checks if ALL steps for the provider are complete,
 * and if so transitions the provider to pending_review.
 */

import { db } from "@/db";
import { onboardingSteps } from "@/db/schema/onboarding-steps";
import { providers } from "@/db/schema/providers";
import { eq, and } from "drizzle-orm";
import { logAudit } from "./audit-logger";
import { broadcastToAdmins } from "@/server/websocket/broadcast";

/**
 * Check if all onboarding steps are complete for a provider,
 * and if so, transition provider status from "onboarding" to "pending_review".
 *
 * @param providerId - The provider to check
 * @param completedStepId - The step that just completed (treated as complete even if DB hasn't committed yet)
 * @param trigger - Audit trail label for what triggered the check
 * @param auditContext - Optional userId/ipAddress/userAgent for audit trail
 * @param existingProvider - Optional pre-fetched provider to avoid redundant DB lookup
 * @returns true if provider was transitioned to pending_review
 */
export async function checkAllStepsCompleteAndTransition(
  providerId: string,
  completedStepId: string,
  trigger: string,
  auditContext?: { userId?: string; ipAddress?: string; userAgent?: string },
  existingProvider?: { id: string; name: string | null; status: string } | null,
): Promise<boolean> {
  const provider = existingProvider ?? await db.query.providers.findFirst({
    where: eq(providers.id, providerId),
  });

  if (!provider || provider.status !== "onboarding") return false;

  const allSteps = await db.query.onboardingSteps.findMany({
    where: eq(onboardingSteps.providerId, providerId),
  });

  const allComplete = allSteps.every((s) =>
    s.id === completedStepId ? true : s.status === "complete",
  );

  if (!allComplete) return false;

  const result = await db
    .update(providers)
    .set({ status: "pending_review", updatedAt: new Date() })
    .where(
      and(
        eq(providers.id, providerId),
        eq(providers.status, "onboarding"),
      ),
    )
    .returning();

  if (result.length > 0) {
    broadcastToAdmins({
      type: "onboarding:ready_for_review",
      data: {
        providerId,
        providerName: provider.name || "",
      },
    });

    logAudit({
      action: "onboarding.status_changed",
      userId: auditContext?.userId,
      resourceType: "provider",
      resourceId: providerId,
      details: {
        previousStatus: "onboarding",
        newStatus: "pending_review",
        reason: "all_steps_complete",
        trigger,
      },
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent,
    });

    return true;
  }

  return false;
}

/**
 * When a stripe_connect step completes, auto-migrate any pending
 * manual_batch payouts to Stripe Connect and reactivate suspended providers.
 */
export async function onStripeConnectStepComplete(providerId: string): Promise<void> {
  // Auto-migrate pending payouts (fire-and-forget)
  const { migratePendingPayoutsToConnect } = await import("./payout-calculator");
  migratePendingPayoutsToConnect(providerId).catch((err) => {
    console.error("[AllStepsComplete] Payout migration failed:", err);
  });

  // Reactivate if suspended due to Connect deadline
  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, providerId),
  });

  if (provider?.status === "suspended" && provider.suspendedReason === "stripe_connect_deadline_expired") {
    await db
      .update(providers)
      .set({
        status: "active",
        suspendedAt: null,
        suspendedReason: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(providers.id, providerId),
          eq(providers.status, "suspended"),
        ),
      );

    logAudit({
      action: "provider.reactivated",
      resourceType: "provider",
      resourceId: providerId,
      details: {
        reason: "stripe_connect_completed_after_suspension",
        previousSuspendedReason: "stripe_connect_deadline_expired",
      },
    });
  }
}

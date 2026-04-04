/**
 * Polling fallback reconciliation for external integrations.
 * Ensures no provider gets stuck due to missed webhooks.
 *
 * NFR-I2: Checkr polling activates for checks pending > 24 hours
 * NFR-I6: Zero orphaned provider states
 */

import { db } from "@/db";
import { onboardingSteps } from "@/db/schema/onboarding-steps";
import { providers } from "@/db/schema/providers";
import { eq, and, lt, isNull } from "drizzle-orm";
import { getReport, CheckrApiError } from "./checkr";
import { isValidStepTransition } from "./onboarding-state-machine";
import { logAudit } from "./audit-logger";
import { broadcastToUser, broadcastToAdmins } from "@/server/websocket/broadcast";
import { notifyBackgroundCheckResult } from "@/lib/notifications";
import { CHECKR_POLLING_THRESHOLD_HOURS, CHECKR_STATUS_MAP, MIGRATION_LAUNCH_DATE, MIGRATION_DEPRECATION_DAYS, MIGRATION_GRACE_PERIOD_DAYS } from "@/lib/constants";
import { stripe } from "@/lib/stripe";
import { checkAllStepsCompleteAndTransition, onStripeConnectStepComplete } from "./all-steps-complete";

export interface ReconciliationDetail {
  providerId: string;
  stepId: string;
  previousStatus: string;
  newStatus: string;
  checkrStatus: string;
  adjudication: string | null;
}

export interface ReconciliationResult {
  checked: number;
  updated: number;
  errors: number;
  details: ReconciliationDetail[];
}

export async function reconcileCheckrStatuses(): Promise<ReconciliationResult> {
  const threshold = new Date(
    Date.now() - CHECKR_POLLING_THRESHOLD_HOURS * 60 * 60 * 1000,
  );

  const staleSteps = await db
    .select()
    .from(onboardingSteps)
    .where(
      and(
        eq(onboardingSteps.stepType, "background_check"),
        eq(onboardingSteps.status, "in_progress"),
        lt(onboardingSteps.updatedAt, threshold),
      ),
    );

  let updated = 0;
  let errors = 0;
  const details: ReconciliationDetail[] = [];

  for (const step of staleSteps) {
    const metadata = step.metadata as {
      checkrReportId?: string | null;
      checkrCandidateId?: string | null;
    } | null;

    if (!metadata?.checkrReportId) continue;

    try {
      const report = await getReport(metadata.checkrReportId);

      if (report.status === "pending") continue; // Still pending, skip

      const effectiveStatus = report.adjudication || report.status;
      const newStepStatus = CHECKR_STATUS_MAP[effectiveStatus];
      if (!newStepStatus) continue;

      if (!isValidStepTransition(step.status, newStepStatus)) continue;

      await db
        .update(onboardingSteps)
        .set({
          status: newStepStatus as typeof step.status,
          completedAt: newStepStatus === "complete" ? new Date() : null,
          rejectionReason:
            newStepStatus === "rejected"
              ? `Background check result: ${effectiveStatus}`
              : null,
          updatedAt: new Date(),
        })
        .where(
          and(eq(onboardingSteps.id, step.id), eq(onboardingSteps.status, "in_progress")),
        );

      details.push({
        providerId: step.providerId,
        stepId: step.id,
        previousStatus: step.status,
        newStatus: newStepStatus,
        checkrStatus: report.status,
        adjudication: report.adjudication,
      });

      logAudit({
        action: "checkr.report_received",
        resourceType: "onboarding_step",
        resourceId: step.id,
        details: {
          checkrStatus: report.status,
          adjudication: report.adjudication,
          reportId: metadata.checkrReportId,
          providerId: step.providerId,
          newStepStatus,
          source: "reconciliation",
        },
      });

      // Broadcast + notify
      const provider = await db.query.providers.findFirst({
        where: eq(providers.id, step.providerId),
      });

      if (provider?.userId) {
        broadcastToUser(provider.userId, {
          type: "onboarding:step_updated",
          data: {
            providerId: step.providerId,
            stepType: "background_check",
            newStatus: newStepStatus,
          },
        });

        notifyBackgroundCheckResult(step.providerId, effectiveStatus).catch((err) => {
          console.error("[Notifications] Failed:", err);
        });
      }

      if (newStepStatus === "pending_review") {
        broadcastToAdmins({
          type: "onboarding:step_updated",
          data: {
            providerId: step.providerId,
            stepType: "background_check",
            newStatus: "pending_review",
          },
        });
      }

      // All-steps-complete auto-transition
      if (newStepStatus === "complete") {
        await checkAllStepsCompleteAndTransition(
          step.providerId, step.id, "checkr_reconciliation",
          undefined, provider,
        );
      }

      updated++;
    } catch (err) {
      errors++;
      console.error(
        `[Reconciliation] Checkr poll failed for step ${step.id}:`,
        err instanceof CheckrApiError
          ? `${err.statusCode}: ${err.message}`
          : err,
      );
    }
  }

  logAudit({
    action: "checkr.reconciliation_run",
    details: { checked: staleSteps.length, updated, errors },
  });

  return { checked: staleSteps.length, updated, errors, details };
}

// ── Stripe Connect Reconciliation ─────────────────────────────────

const STRIPE_CONNECT_POLLING_THRESHOLD_HOURS = 4;

export async function reconcileStripeConnectStatuses(): Promise<ReconciliationResult> {
  const threshold = new Date(
    Date.now() - STRIPE_CONNECT_POLLING_THRESHOLD_HOURS * 60 * 60 * 1000,
  );

  const staleSteps = await db
    .select()
    .from(onboardingSteps)
    .where(
      and(
        eq(onboardingSteps.stepType, "stripe_connect"),
        eq(onboardingSteps.status, "in_progress"),
        lt(onboardingSteps.updatedAt, threshold),
      ),
    );

  let updated = 0;
  let errors = 0;
  const details: ReconciliationDetail[] = [];

  for (const step of staleSteps) {
    const metadata = step.metadata as { stripeConnectAccountId?: string } | null;
    if (!metadata?.stripeConnectAccountId) continue;

    try {
      const account = await stripe.accounts.retrieve(metadata.stripeConnectAccountId);

      if (!account.details_submitted || !account.charges_enabled) continue; // Not yet ready

      if (!isValidStepTransition(step.status, "complete")) continue;

      await db
        .update(onboardingSteps)
        .set({
          status: "complete",
          completedAt: new Date(),
          metadata: {
            ...metadata,
            chargesEnabledAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(onboardingSteps.id, step.id),
            eq(onboardingSteps.status, "in_progress"),
          ),
        );

      details.push({
        providerId: step.providerId,
        stepId: step.id,
        previousStatus: step.status,
        newStatus: "complete",
        checkrStatus: "charges_enabled",
        adjudication: null,
      });

      logAudit({
        action: "stripe_connect.onboarding_completed",
        resourceType: "onboarding_step",
        resourceId: step.id,
        details: {
          providerId: step.providerId,
          stripeAccountId: metadata.stripeConnectAccountId,
          source: "reconciliation",
        },
      });

      // Broadcast + all-steps-complete check
      const provider = await db.query.providers.findFirst({
        where: eq(providers.id, step.providerId),
      });

      if (provider?.userId) {
        broadcastToUser(provider.userId, {
          type: "onboarding:step_updated",
          data: {
            providerId: step.providerId,
            stepType: "stripe_connect",
            newStatus: "complete",
          },
        });
      }

      await checkAllStepsCompleteAndTransition(
        step.providerId, step.id, "stripe_connect_reconciliation",
        undefined, provider,
      );

      // Auto-migrate pending payouts + reactivate if suspended
      onStripeConnectStepComplete(step.providerId).catch((err) => {
        console.error("[Reconciliation] onStripeConnectStepComplete failed:", err);
      });

      updated++;
    } catch (err) {
      errors++;
      console.error(
        `[Reconciliation] Stripe Connect poll failed for step ${step.id}:`,
        err,
      );
    }
  }

  logAudit({
    action: "stripe_connect.reconciliation_run",
    details: { checked: staleSteps.length, updated, errors },
  });

  return { checked: staleSteps.length, updated, errors, details };
}

// ── Stripe Connect Abandonment Reminders ──────────────────────────

const STRIPE_CONNECT_REMINDER_THRESHOLDS = [
  { hours: 24, reminderNumber: 1 },
  { hours: 72, reminderNumber: 2 },
];

export interface AbandonmentResult {
  checked: number;
  reminded: number;
  errors: number;
}

export async function checkStripeConnectAbandonment(): Promise<AbandonmentResult> {
  const { notifyStripeConnectReminder } = await import("@/lib/notifications");

  let reminded = 0;
  let errors = 0;

  // Find all in_progress stripe_connect steps
  const inProgressSteps = await db
    .select()
    .from(onboardingSteps)
    .where(
      and(
        eq(onboardingSteps.stepType, "stripe_connect"),
        eq(onboardingSteps.status, "in_progress"),
      ),
    );

  for (const step of inProgressSteps) {
    const metadata = (step.metadata || {}) as Record<string, unknown>;
    const remindersSent = (metadata.remindersSent as number) || 0;
    const stepAgeHours = (Date.now() - step.updatedAt.getTime()) / (60 * 60 * 1000);

    // Find the next applicable threshold
    const nextReminder = STRIPE_CONNECT_REMINDER_THRESHOLDS.find(
      (t) => t.reminderNumber === remindersSent + 1 && stepAgeHours >= t.hours,
    );

    if (!nextReminder) continue;

    try {
      await notifyStripeConnectReminder(step.providerId, nextReminder.hours);

      // Update metadata with reminder count
      await db
        .update(onboardingSteps)
        .set({
          metadata: { ...metadata, remindersSent: nextReminder.reminderNumber },
          updatedAt: step.updatedAt, // Preserve original updatedAt to not reset stale detection
        })
        .where(eq(onboardingSteps.id, step.id));

      logAudit({
        action: "stripe_connect.reminder_sent",
        resourceType: "onboarding_step",
        resourceId: step.id,
        details: {
          providerId: step.providerId,
          reminderNumber: nextReminder.reminderNumber,
          hoursElapsed: Math.round(stepAgeHours),
        },
      });

      reminded++;
    } catch (err) {
      errors++;
      console.error(
        `[Reconciliation] Stripe Connect reminder failed for step ${step.id}:`,
        err,
      );
    }
  }

  return { checked: inProgressSteps.length, reminded, errors };
}

// ── Stripe Connect Deadline Enforcement ──────────────────────────

export interface DeadlineEnforcementResult {
  checked: number;
  suspended: number;
  errors: number;
}

export async function enforceStripeConnectDeadline(): Promise<DeadlineEnforcementResult> {
  if (!MIGRATION_LAUNCH_DATE) {
    return { checked: 0, suspended: 0, errors: 0 };
  }

  const graceEndDate = new Date(
    MIGRATION_LAUNCH_DATE.getTime() +
    (MIGRATION_DEPRECATION_DAYS + MIGRATION_GRACE_PERIOD_DAYS) * 24 * 60 * 60 * 1000,
  );

  if (new Date() <= graceEndDate) {
    return { checked: 0, suspended: 0, errors: 0 };
  }

  // Find active providers without Stripe Connect account
  const nonCompliantProviders = await db
    .select()
    .from(providers)
    .where(
      and(
        eq(providers.status, "active"),
        isNull(providers.stripeConnectAccountId),
      ),
    );

  let suspended = 0;
  let errors = 0;

  for (const provider of nonCompliantProviders) {
    try {
      const [updated] = await db
        .update(providers)
        .set({
          status: "suspended",
          suspendedAt: new Date(),
          suspendedReason: "stripe_connect_deadline_expired",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(providers.id, provider.id),
            eq(providers.status, "active"),
          ),
        )
        .returning();

      if (updated) {
        logAudit({
          action: "provider.suspended",
          resourceType: "provider",
          resourceId: provider.id,
          details: {
            reason: "stripe_connect_deadline_expired",
            migrationLaunchDate: MIGRATION_LAUNCH_DATE.toISOString(),
          },
        });

        // Fire-and-forget notification
        const { notifyConnectDeadlineExpired } = await import("@/lib/notifications");
        notifyConnectDeadlineExpired(provider.id).catch((err) => {
          console.error("[Reconciliation] Deadline notification failed:", err);
        });

        suspended++;
      }
    } catch (err) {
      errors++;
      console.error(
        `[Reconciliation] Deadline enforcement failed for provider ${provider.id}:`,
        err,
      );
    }
  }

  logAudit({
    action: "stripe_connect.deadline_enforcement_run",
    details: { checked: nonCompliantProviders.length, suspended, errors },
  });

  return { checked: nonCompliantProviders.length, suspended, errors };
}

// ── Migration Reminder Notifications ─────────────────────────────

export interface MigrationReminderResult {
  checked: number;
  reminded: number;
  errors: number;
}

export async function checkMigrationReminders(): Promise<MigrationReminderResult> {
  // Find active providers with migrationBypassExpiresAt set (migrating)
  const { isNotNull } = await import("drizzle-orm");
  const migratingProviders = await db
    .select()
    .from(providers)
    .where(
      and(
        eq(providers.status, "active"),
        isNotNull(providers.migrationBypassExpiresAt),
      ),
    );

  let reminded = 0;
  let errors = 0;
  const now = new Date();

  for (const provider of migratingProviders) {
    if (!provider.migrationBypassExpiresAt) continue;

    // Calculate days since migration started (bypass is 30 days from start)
    const migrationStartMs = provider.migrationBypassExpiresAt.getTime() - (30 * 24 * 60 * 60 * 1000);
    const daysSinceStart = Math.floor((now.getTime() - migrationStartMs) / (24 * 60 * 60 * 1000));

    // Determine which reminder to send based on day ranges
    // Use window-based approach: send Day 14 on days 14-24, Day 25 on days 25-29
    // Cron runs every 6h, so the window ensures at most 1 send per provider
    // Dedup: we only send if the provider's updatedAt hasn't been touched for migration reminders recently
    let reminderDay: number | null = null;
    if (daysSinceStart >= 25 && daysSinceStart < 30) {
      reminderDay = 25;
    } else if (daysSinceStart >= 14 && daysSinceStart < 25) {
      reminderDay = 14;
    }

    if (!reminderDay) continue;

    // Simple dedup: check if we already sent this exact day reminder
    // by looking at audit log via raw SQL (audit_events is write-optimized, not in relational queries)
    const { sql } = await import("drizzle-orm");
    const existing = await db.execute(
      sql`SELECT 1 FROM audit_events WHERE action = 'migration.reminder_sent' AND resource_id = ${provider.id} AND details->>'day' = ${String(reminderDay)} LIMIT 1`,
    );
    if (existing.length > 0) continue;

    try {
      if (reminderDay === 14) {
        const { notifyMigrationDay14 } = await import("@/lib/notifications");
        await notifyMigrationDay14(provider.id);
      } else if (reminderDay === 25) {
        const { notifyMigrationDay25 } = await import("@/lib/notifications");
        await notifyMigrationDay25(provider.id);
      }

      logAudit({
        action: "migration.reminder_sent",
        resourceType: "provider",
        resourceId: provider.id,
        details: { day: reminderDay, daysSinceStart },
      });

      reminded++;
    } catch (err) {
      errors++;
      console.error(`[Reconciliation] Migration reminder failed for provider ${provider.id}:`, err);
    }
  }

  logAudit({
    action: "migration.reminder_check_run",
    details: { checked: migratingProviders.length, reminded, errors },
  });

  return { checked: migratingProviders.length, reminded, errors };
}

// ── Migration Deadline Enforcement ───────────────────────────────

export interface MigrationDeadlineResult {
  checked: number;
  suspended: number;
  errors: number;
}

export async function enforceMigrationDeadline(): Promise<MigrationDeadlineResult> {
  const now = new Date();

  // Find active providers whose migration bypass has expired
  const expiredProviders = await db
    .select()
    .from(providers)
    .where(
      and(
        eq(providers.status, "active"),
        lt(providers.migrationBypassExpiresAt, now),
      ),
    );

  // Filter to only those with incomplete onboarding steps
  let suspended = 0;
  let errors = 0;

  for (const provider of expiredProviders) {
    const steps = await db.query.onboardingSteps.findMany({
      where: eq(onboardingSteps.providerId, provider.id),
    });

    // If no steps exist or all complete, skip (migration completed, just bypass not cleared)
    if (steps.length === 0) continue;
    const allComplete = steps.every((s) => s.status === "complete");
    if (allComplete) {
      // Migration completed but bypass wasn't cleared — clean up
      await db
        .update(providers)
        .set({ migrationBypassExpiresAt: null, updatedAt: new Date() })
        .where(eq(providers.id, provider.id));
      continue;
    }

    try {
      const [updated] = await db
        .update(providers)
        .set({
          status: "suspended",
          suspendedAt: now,
          suspendedReason: "migration_deadline_expired",
          updatedAt: now,
        })
        .where(
          and(
            eq(providers.id, provider.id),
            eq(providers.status, "active"),
          ),
        )
        .returning();

      if (updated) {
        logAudit({
          action: "migration.suspended_deadline",
          resourceType: "provider",
          resourceId: provider.id,
          details: {
            reason: "migration_deadline_expired",
            bypassExpiredAt: provider.migrationBypassExpiresAt?.toISOString(),
          },
        });

        const { notifyMigrationSuspended } = await import("@/lib/notifications");
        notifyMigrationSuspended(provider.id).catch((err) => {
          console.error("[Reconciliation] Migration suspension notification failed:", err);
        });

        suspended++;
      }
    } catch (err) {
      errors++;
      console.error(`[Reconciliation] Migration deadline enforcement failed for provider ${provider.id}:`, err);
    }
  }

  logAudit({
    action: "migration.deadline_enforcement_run",
    details: { checked: expiredProviders.length, suspended, errors },
  });

  return { checked: expiredProviders.length, suspended, errors };
}

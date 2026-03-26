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

/**
 * Reconciliation functions — invoked by server/cron.ts on a schedule.
 *
 * - Checkr: background check status sync (every 1h)
 * - Stripe Connect: onboarding status sync (every 4h)
 * - Stripe Connect abandonment: reminders for stalled onboarding (every 6h)
 * - Stripe Connect deadline: suspend providers past deadline (daily)
 * - Migration reminders: nudge providers still on manual_batch (every 6h)
 * - Migration deadline: suspend non-compliant providers (daily)
 */

import { db } from "@/db";
import { providers } from "@/db/schema/providers";
import { onboardingSteps } from "@/db/schema/onboarding-steps";
import { eq, and, sql, lt, isNotNull, isNull } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import { logAudit } from "./audit-logger";
import { isValidStepTransition } from "./onboarding-state-machine";
import { checkAllStepsCompleteAndTransition } from "./all-steps-complete";
import {
  MIGRATION_LAUNCH_DATE,
  MIGRATION_DEPRECATION_DAYS,
  MIGRATION_GRACE_PERIOD_DAYS,
  CHECKR_STATUS_MAP,
} from "@/lib/constants";
import {
  notifyStripeConnectReminder,
  notifyConnectDeadlineExpired,
  notifyMigrationDay0,
  notifyMigrationDay14,
  notifyMigrationDay25,
  notifyMigrationSuspended,
} from "@/lib/notifications";
import { providerPayouts, payments, bookings } from "@/db/schema";
import { isFeatureEnabled, FEATURE_FLAGS } from "./feature-flags";

export interface ReconciliationResult {
  checked: number;
  updated: number;
  errors: number;
  details: Array<{ stepId: string; providerId: string; newStatus: string }>;
}

export interface AbandonmentResult {
  reminded: number;
}

// ── Helpers ──────────────────────────────────────────────────────

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── 1. Checkr Status Reconciliation ─────────────────────────────

/**
 * Polls Checkr API for background checks stuck in "in_progress".
 * Syncs status back to onboarding_steps if Checkr has progressed.
 */
export async function reconcileCheckrStatuses(): Promise<{
  reconciled: number;
  details: Array<{ providerId: string; checkrStatus: string; adjudication: string }>;
}> {
  if (!(await isFeatureEnabled(FEATURE_FLAGS.CHECKR_RECONCILIATION))) {
    logger.info("[Reconciliation] reconcileCheckrStatuses — disabled via feature flag");
    return { reconciled: 0, details: [] };
  }

  const checkrApiKey = process.env.CHECKR_API_KEY;
  if (!checkrApiKey) {
    logger.warn("[Reconciliation] CHECKR_API_KEY not set — skipping Checkr reconciliation");
    return { reconciled: 0, details: [] };
  }

  // Find all background_check steps that are in_progress
  const inProgressSteps = await db
    .select()
    .from(onboardingSteps)
    .where(
      and(
        eq(onboardingSteps.stepType, "background_check"),
        eq(onboardingSteps.status, "in_progress"),
      ),
    );

  if (inProgressSteps.length === 0) {
    logger.info("[Reconciliation] reconcileCheckrStatuses — no in-progress steps");
    return { reconciled: 0, details: [] };
  }

  let reconciled = 0;
  const details: Array<{ providerId: string; checkrStatus: string; adjudication: string }> = [];

  for (let i = 0; i < inProgressSteps.length; i++) {
    const step = inProgressSteps[i]!;
    const metadata = (step.metadata || {}) as Record<string, unknown>;
    const candidateId = metadata.checkrCandidateId as string | undefined;
    const reportId = metadata.checkrReportId as string | undefined;

    if (!candidateId && !reportId) continue;

    try {
      // Prefer report endpoint if we have an ID, otherwise list reports by candidate
      let reportData: { status: string; adjudication: string | null } | null = null;

      if (reportId) {
        const resp = await fetch(`https://api.checkr.com/v1/reports/${reportId}`, {
          headers: { Authorization: `Basic ${Buffer.from(checkrApiKey + ":").toString("base64")}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          reportData = { status: data.status, adjudication: data.adjudication };
        }
      } else if (candidateId) {
        const resp = await fetch(`https://api.checkr.com/v1/candidates/${candidateId}/reports`, {
          headers: { Authorization: `Basic ${Buffer.from(checkrApiKey + ":").toString("base64")}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          const reports = data.data || [];
          if (reports.length > 0) {
            const latest = reports[reports.length - 1];
            reportData = { status: latest.status, adjudication: latest.adjudication };
            // Backfill report ID
            await db
              .update(onboardingSteps)
              .set({ metadata: { ...metadata, checkrReportId: latest.id }, updatedAt: new Date() })
              .where(eq(onboardingSteps.id, step.id));
          }
        }
      }

      if (!reportData || reportData.status === "pending") continue;

      const effectiveStatus = reportData.adjudication || reportData.status;
      const newStepStatus = CHECKR_STATUS_MAP[effectiveStatus] || "in_progress";

      if (newStepStatus !== "in_progress" && isValidStepTransition(step.status, newStepStatus)) {
        await db
          .update(onboardingSteps)
          .set({
            status: newStepStatus as typeof step.status,
            completedAt: newStepStatus === "complete" ? new Date() : null,
            rejectionReason: newStepStatus === "rejected" ? `Background check: ${effectiveStatus}` : null,
            updatedAt: new Date(),
          })
          .where(and(eq(onboardingSteps.id, step.id), eq(onboardingSteps.status, step.status)));

        logAudit({
          action: "reconciliation.checkr_status_sync",
          resourceType: "onboarding_step",
          resourceId: step.id,
          details: { providerId: step.providerId, effectiveStatus, newStepStatus },
        });

        if (newStepStatus === "complete") {
          await checkAllStepsCompleteAndTransition(step.providerId, step.id, "checkr_reconciliation");
        }

        reconciled++;
        details.push({
          providerId: step.providerId,
          checkrStatus: reportData.status,
          adjudication: reportData.adjudication || "none",
        });
      }
    } catch (err) {
      logger.error("[Reconciliation] Checkr API error", {
        stepId: step.id,
        providerId: step.providerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Rate limit: pause between batches
    if ((i + 1) % BATCH_SIZE === 0) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  logger.info("[Reconciliation] reconcileCheckrStatuses complete", { reconciled, total: inProgressSteps.length });
  return { reconciled, details };
}

// ── 2. Stripe Connect Status Reconciliation ─────────────────────

/**
 * Polls stripe.accounts.retrieve() for providers with Connect accounts.
 * Fixes drift between Stripe's charges_enabled/details_submitted and
 * our onboarding_steps status.
 */
export async function reconcileStripeConnectStatuses(): Promise<ReconciliationResult> {
  if (!(await isFeatureEnabled(FEATURE_FLAGS.STRIPE_CONNECT_RECONCILIATION))) {
    logger.info("[Reconciliation] reconcileStripeConnectStatuses — disabled via feature flag");
    return { checked: 0, updated: 0, errors: 0, details: [] };
  }

  const stripe = getStripe();

  // Find providers with Connect accounts that have a stripe_connect step not yet complete
  const stepsToCheck = await db
    .select({
      step: onboardingSteps,
      provider: {
        id: providers.id,
        stripeConnectAccountId: providers.stripeConnectAccountId,
        name: providers.name,
        status: providers.status,
      },
    })
    .from(onboardingSteps)
    .innerJoin(providers, eq(onboardingSteps.providerId, providers.id))
    .where(
      and(
        eq(onboardingSteps.stepType, "stripe_connect"),
        sql`${onboardingSteps.status} IN ('pending', 'draft', 'in_progress')`,
        isNotNull(providers.stripeConnectAccountId),
      ),
    );

  if (stepsToCheck.length === 0) {
    logger.info("[Reconciliation] reconcileStripeConnectStatuses — nothing to check");
    return { checked: 0, updated: 0, errors: 0, details: [] };
  }

  let checked = 0;
  let updated = 0;
  let errors = 0;
  const details: Array<{ stepId: string; providerId: string; newStatus: string }> = [];

  for (let i = 0; i < stepsToCheck.length; i++) {
    const { step, provider } = stepsToCheck[i]!;
    checked++;

    try {
      const account = await stripe.accounts.retrieve(provider.stripeConnectAccountId!);

      if (account.charges_enabled && account.details_submitted) {
        // Stripe says account is fully ready — mark step complete if not already
        if (isValidStepTransition(step.status, "complete")) {
          await db
            .update(onboardingSteps)
            .set({
              status: "complete",
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(and(eq(onboardingSteps.id, step.id), eq(onboardingSteps.status, step.status)));

          logAudit({
            action: "reconciliation.stripe_connect_status_sync",
            resourceType: "onboarding_step",
            resourceId: step.id,
            details: {
              providerId: provider.id,
              chargesEnabled: true,
              detailsSubmitted: true,
              previousStatus: step.status,
            },
          });

          await checkAllStepsCompleteAndTransition(provider.id, step.id, "stripe_connect_reconciliation");

          updated++;
          details.push({ stepId: step.id, providerId: provider.id, newStatus: "complete" });
        }
      } else if (account.details_submitted && !account.charges_enabled) {
        // Details submitted but charges not enabled — Stripe is reviewing
        if (step.status === "pending" || step.status === "draft") {
          await db
            .update(onboardingSteps)
            .set({ status: "in_progress", updatedAt: new Date() })
            .where(eq(onboardingSteps.id, step.id));

          updated++;
          details.push({ stepId: step.id, providerId: provider.id, newStatus: "in_progress" });
        }
      }
    } catch (err) {
      logger.error("[Reconciliation] Stripe account retrieve error", {
        providerId: provider.id,
        accountId: provider.stripeConnectAccountId,
        error: err instanceof Error ? err.message : String(err),
      });
      errors++;
    }

    // Rate limit between batches
    if ((i + 1) % BATCH_SIZE === 0) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  logger.info("[Reconciliation] reconcileStripeConnectStatuses complete", { checked, updated, errors });
  return { checked, updated, errors, details };
}

// ── 3. Stripe Connect Abandonment Reminders ─────────────────────

/**
 * Sends reminders to providers who started Connect onboarding but haven't
 * completed it within expected timeframes (48h, 7d).
 */
export async function checkStripeConnectAbandonment(): Promise<AbandonmentResult> {
  if (!(await isFeatureEnabled(FEATURE_FLAGS.STRIPE_CONNECT_ABANDONMENT))) {
    logger.info("[Reconciliation] checkStripeConnectAbandonment — disabled via feature flag");
    return { reminded: 0 };
  }

  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // Find stripe_connect steps that are in_progress and stalled > 48h
  const stalledSteps = await db
    .select({
      step: onboardingSteps,
      providerId: providers.id,
    })
    .from(onboardingSteps)
    .innerJoin(providers, eq(onboardingSteps.providerId, providers.id))
    .where(
      and(
        eq(onboardingSteps.stepType, "stripe_connect"),
        eq(onboardingSteps.status, "in_progress"),
        lt(onboardingSteps.updatedAt, fortyEightHoursAgo),
      ),
    );

  let reminded = 0;

  for (const { step, providerId } of stalledSteps) {
    const hoursElapsed = Math.round((now.getTime() - step.updatedAt.getTime()) / (60 * 60 * 1000));

    // Only send reminders at 48h and 168h (7 days) — avoid spamming
    const metadata = (step.metadata || {}) as Record<string, unknown>;
    const lastReminderHours = (metadata.lastReminderHoursElapsed as number) || 0;

    const shouldRemind =
      (hoursElapsed >= 48 && lastReminderHours < 48) ||
      (hoursElapsed >= 168 && lastReminderHours < 168);

    if (!shouldRemind) continue;

    try {
      notifyStripeConnectReminder(providerId, hoursElapsed).catch((err) => {
        console.error("[Notifications] Failed:", err);
      });

      // Track that we sent a reminder
      await db
        .update(onboardingSteps)
        .set({
          metadata: { ...metadata, lastReminderHoursElapsed: hoursElapsed, lastReminderAt: now.toISOString() },
        })
        .where(eq(onboardingSteps.id, step.id));

      logAudit({
        action: "reconciliation.stripe_connect_abandonment_reminder",
        resourceType: "onboarding_step",
        resourceId: step.id,
        details: { providerId, hoursElapsed },
      });

      reminded++;
    } catch (err) {
      logger.error("[Reconciliation] Abandonment reminder failed", {
        stepId: step.id,
        providerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("[Reconciliation] checkStripeConnectAbandonment complete", { reminded, checked: stalledSteps.length });
  return { reminded };
}

// ── 4. Stripe Connect Deadline Enforcement ──────────────────────

/**
 * Suspends providers who haven't completed Stripe Connect setup
 * within the configured deadline (based on their onboarding step creation date).
 *
 * Default deadline: 30 days after step was created.
 */
const STRIPE_CONNECT_DEADLINE_DAYS = 30;

export async function enforceStripeConnectDeadline(): Promise<{
  enforced: number;
  checked: number;
  suspended: number;
}> {
  if (!(await isFeatureEnabled(FEATURE_FLAGS.STRIPE_CONNECT_DEADLINE))) {
    logger.info("[Reconciliation] enforceStripeConnectDeadline — disabled via feature flag");
    return { enforced: 0, checked: 0, suspended: 0 };
  }

  const now = new Date();
  const deadlineCutoff = new Date(now.getTime() - STRIPE_CONNECT_DEADLINE_DAYS * 24 * 60 * 60 * 1000);

  // Find providers with incomplete stripe_connect steps past the deadline
  const overdue = await db
    .select({
      step: onboardingSteps,
      provider: providers,
    })
    .from(onboardingSteps)
    .innerJoin(providers, eq(onboardingSteps.providerId, providers.id))
    .where(
      and(
        eq(onboardingSteps.stepType, "stripe_connect"),
        sql`${onboardingSteps.status} IN ('pending', 'draft', 'in_progress')`,
        lt(onboardingSteps.createdAt, deadlineCutoff),
        sql`${providers.status} NOT IN ('suspended', 'rejected')`,
      ),
    );

  let suspended = 0;

  for (const { step, provider } of overdue) {
    try {
      await db
        .update(providers)
        .set({
          status: "suspended",
          suspendedAt: now,
          suspendedReason: "stripe_connect_deadline_expired",
          updatedAt: now,
        })
        .where(and(eq(providers.id, provider.id), sql`${providers.status} != 'suspended'`));

      logAudit({
        action: "reconciliation.stripe_connect_deadline_suspend",
        resourceType: "provider",
        resourceId: provider.id,
        details: {
          stepId: step.id,
          stepCreatedAt: step.createdAt.toISOString(),
          deadlineDays: STRIPE_CONNECT_DEADLINE_DAYS,
        },
      });

      notifyConnectDeadlineExpired(provider.id).catch((err) => {
        console.error("[Notifications] Failed:", err);
      });

      suspended++;
    } catch (err) {
      logger.error("[Reconciliation] Deadline enforcement failed", {
        providerId: provider.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("[Reconciliation] enforceStripeConnectDeadline complete", {
    checked: overdue.length,
    suspended,
  });

  return { enforced: suspended, checked: overdue.length, suspended };
}

// ── 5. Migration Reminders ──────────────────────────────────────

/**
 * Sends migration reminders to active providers who are still using
 * manual_batch payouts and haven't started Stripe Connect onboarding.
 *
 * Reminder schedule (days since MIGRATION_LAUNCH_DATE):
 * - Day 0: Initial migration announcement
 * - Day 14: Follow-up reminder
 * - Day 25: Urgent reminder (5 days before deprecation if 30-day window)
 */
export async function checkMigrationReminders(): Promise<{ reminded: number }> {
  if (!(await isFeatureEnabled(FEATURE_FLAGS.MIGRATION_REMINDERS))) {
    logger.info("[Reconciliation] checkMigrationReminders — disabled via feature flag");
    return { reminded: 0 };
  }

  if (!MIGRATION_LAUNCH_DATE) {
    return { reminded: 0 };
  }

  const now = new Date();
  const daysSinceLaunch = Math.floor((now.getTime() - MIGRATION_LAUNCH_DATE.getTime()) / (24 * 60 * 60 * 1000));

  if (daysSinceLaunch < 0) {
    return { reminded: 0 }; // Migration hasn't launched yet
  }

  // Find active providers without a Connect account and no completed stripe_connect step
  const nonConnectProviders = await db
    .select({ provider: providers })
    .from(providers)
    .where(
      and(
        eq(providers.status, "active"),
        isNull(providers.stripeConnectAccountId),
      ),
    );

  let reminded = 0;

  for (const { provider } of nonConnectProviders) {
    // Check if they have any stripe_connect step already
    const existingStep = await db.query.onboardingSteps.findFirst({
      where: and(
        eq(onboardingSteps.providerId, provider.id),
        eq(onboardingSteps.stepType, "stripe_connect"),
      ),
    });

    // If they've already started (in_progress), abandonment reminders handle it
    if (existingStep && existingStep.status !== "pending") continue;

    // Check bypass expiration
    if (provider.migrationBypassExpiresAt && provider.migrationBypassExpiresAt > now) continue;

    try {
      // Send appropriate reminder based on days since launch
      const deprecationDate = new Date(MIGRATION_LAUNCH_DATE.getTime() + MIGRATION_DEPRECATION_DAYS * 24 * 60 * 60 * 1000);
      if (daysSinceLaunch <= 1) {
        notifyMigrationDay0(provider.id, deprecationDate.toISOString().split("T")[0]!).catch((err) => { console.error("[Notifications] Failed:", err); });
        reminded++;
      } else if (daysSinceLaunch >= 14 && daysSinceLaunch < 16) {
        notifyMigrationDay14(provider.id).catch((err) => { console.error("[Notifications] Failed:", err); });
        reminded++;
      } else if (daysSinceLaunch >= 25 && daysSinceLaunch < 27) {
        notifyMigrationDay25(provider.id).catch((err) => { console.error("[Notifications] Failed:", err); });
        reminded++;
      }
    } catch (err) {
      logger.error("[Reconciliation] Migration reminder failed", {
        providerId: provider.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("[Reconciliation] checkMigrationReminders complete", { reminded, daysSinceLaunch });
  return { reminded };
}

// ── 6. Migration Deadline Enforcement ───────────────────────────

/**
 * Suspends active providers who haven't migrated to Stripe Connect
 * after the deprecation period + grace period has elapsed.
 */
export async function enforceMigrationDeadline(): Promise<{ enforced: number }> {
  if (!(await isFeatureEnabled(FEATURE_FLAGS.MIGRATION_DEADLINE))) {
    logger.info("[Reconciliation] enforceMigrationDeadline — disabled via feature flag");
    return { enforced: 0 };
  }

  if (!MIGRATION_LAUNCH_DATE) {
    return { enforced: 0 };
  }

  const now = new Date();
  const deprecationDate = new Date(MIGRATION_LAUNCH_DATE.getTime() + MIGRATION_DEPRECATION_DAYS * 24 * 60 * 60 * 1000);
  const graceEndDate = new Date(deprecationDate.getTime() + MIGRATION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  if (now < graceEndDate) {
    logger.info("[Reconciliation] enforceMigrationDeadline — grace period not yet expired", {
      graceEndDate: graceEndDate.toISOString(),
    });
    return { enforced: 0 };
  }

  // Find active providers without Stripe Connect, not bypassed
  const nonCompliant = await db
    .select({ provider: providers })
    .from(providers)
    .where(
      and(
        eq(providers.status, "active"),
        isNull(providers.stripeConnectAccountId),
        sql`(${providers.migrationBypassExpiresAt} IS NULL OR ${providers.migrationBypassExpiresAt} < ${now})`,
      ),
    );

  let enforced = 0;

  for (const { provider } of nonCompliant) {
    try {
      await db
        .update(providers)
        .set({
          status: "suspended",
          suspendedAt: now,
          suspendedReason: "stripe_connect_not_completed",
          updatedAt: now,
        })
        .where(and(eq(providers.id, provider.id), eq(providers.status, "active")));

      logAudit({
        action: "reconciliation.migration_deadline_suspend",
        resourceType: "provider",
        resourceId: provider.id,
        details: {
          migrationLaunchDate: MIGRATION_LAUNCH_DATE.toISOString(),
          deprecationDate: deprecationDate.toISOString(),
          graceEndDate: graceEndDate.toISOString(),
        },
      });

      notifyMigrationSuspended(provider.id).catch((err) => {
        console.error("[Notifications] Failed:", err);
      });

      enforced++;
    } catch (err) {
      logger.error("[Reconciliation] Migration deadline enforcement failed", {
        providerId: provider.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("[Reconciliation] enforceMigrationDeadline complete", { enforced, checked: nonCompliant.length });
  return { enforced };
}

// ── 7. Automated Payout Processing ──────────────────────────────

/**
 * Processes pending stripe_connect payouts that weren't auto-transferred
 * at booking completion (e.g., legacy platform charges awaiting batch processing).
 *
 * Runs daily. Skips payouts that are "held" (dispute freeze).
 */
export async function processPendingPayouts(): Promise<{
  processed: number;
  failed: number;
  skippedHeld: number;
}> {
  const stripe = getStripe();

  const pending = await db
    .select({
      payout: providerPayouts,
      provider: {
        id: providers.id,
        stripeConnectAccountId: providers.stripeConnectAccountId,
      },
    })
    .from(providerPayouts)
    .innerJoin(providers, eq(providerPayouts.providerId, providers.id))
    .where(
      and(
        eq(providerPayouts.status, "pending"),
        eq(providerPayouts.payoutMethod, "stripe_connect"),
      ),
    );

  if (pending.length === 0) {
    logger.info("[Reconciliation] processPendingPayouts — no pending payouts");
    return { processed: 0, failed: 0, skippedHeld: 0 };
  }

  let processed = 0;
  let failed = 0;
  const skippedHeld = 0;

  for (let i = 0; i < pending.length; i++) {
    const { payout, provider } = pending[i]!;

    if (!provider.stripeConnectAccountId) {
      // No Connect account — can't process, leave as pending
      continue;
    }

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: payout.amount,
          currency: "usd",
          destination: provider.stripeConnectAccountId,
          transfer_group: payout.bookingId,
          metadata: { payoutId: payout.id, bookingId: payout.bookingId, providerId: provider.id },
        },
        { idempotencyKey: `payout-${payout.id}` },
      );

      await db
        .update(providerPayouts)
        .set({
          status: "paid",
          paidAt: new Date(),
          stripeTransferId: transfer.id,
          metadata: { ...(payout.metadata as Record<string, unknown> || {}), stripeTransferId: transfer.id, processedByCron: true },
        })
        .where(eq(providerPayouts.id, payout.id));

      processed++;
    } catch (err) {
      logger.error("[Reconciliation] Payout transfer failed", {
        payoutId: payout.id,
        providerId: provider.id,
        error: err instanceof Error ? err.message : String(err),
      });
      failed++;
    }

    if ((i + 1) % BATCH_SIZE === 0) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  logger.info("[Reconciliation] processPendingPayouts complete", { processed, failed, skippedHeld, total: pending.length });
  return { processed, failed, skippedHeld };
}

// ── 8. Payment-Payout Reconciliation ────────────────────────────

/**
 * Matches confirmed payments against their corresponding payouts.
 * Flags discrepancies: orphan payments (no payout), orphan payouts (no payment),
 * and amount mismatches (accounting for commission).
 */
export async function reconcilePaymentsAndPayouts(): Promise<{
  matched: number;
  orphanPayments: number;
  orphanPayouts: number;
  mismatches: number;
  details: Array<{ type: string; bookingId: string; paymentId?: string; payoutId?: string; note: string }>;
}> {
  // Confirmed Stripe payments that should have a payout
  const confirmedPayments = await db
    .select({
      payment: payments,
      bookingStatus: bookings.status,
      bookingProviderId: bookings.providerId,
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .where(
      and(
        eq(payments.status, "confirmed"),
        eq(payments.method, "stripe"),
        eq(bookings.status, "completed"),
        isNotNull(bookings.providerId),
      ),
    );

  let matched = 0;
  let orphanPayments = 0;
  let orphanPayouts = 0;
  let mismatches = 0;
  const details: Array<{ type: string; bookingId: string; paymentId?: string; payoutId?: string; note: string }> = [];

  for (const { payment } of confirmedPayments) {
    const payout = await db.query.providerPayouts.findFirst({
      where: and(
        eq(providerPayouts.bookingId, payment.bookingId),
        sql`${providerPayouts.payoutType} = 'standard'`,
      ),
    });

    if (!payout) {
      orphanPayments++;
      details.push({
        type: "orphan_payment",
        bookingId: payment.bookingId,
        paymentId: payment.id,
        note: `Confirmed payment ($${(payment.amount / 100).toFixed(2)}) has no payout record`,
      });
      continue;
    }

    // Check that payment amount >= payout amount (payout should be less due to commission)
    if (payout.amount > payment.amount) {
      mismatches++;
      details.push({
        type: "amount_mismatch",
        bookingId: payment.bookingId,
        paymentId: payment.id,
        payoutId: payout.id,
        note: `Payout ($${(payout.amount / 100).toFixed(2)}) exceeds payment ($${(payment.amount / 100).toFixed(2)})`,
      });
    } else {
      matched++;
    }
  }

  // Check for orphan payouts (payouts without a matching confirmed payment)
  const allStandardPayouts = await db
    .select({ payout: providerPayouts })
    .from(providerPayouts)
    .where(sql`${providerPayouts.payoutType} = 'standard'`);

  for (const { payout } of allStandardPayouts) {
    const confirmedPayment = await db.query.payments.findFirst({
      where: and(
        eq(payments.bookingId, payout.bookingId),
        eq(payments.status, "confirmed"),
      ),
    });

    if (!confirmedPayment) {
      orphanPayouts++;
      details.push({
        type: "orphan_payout",
        bookingId: payout.bookingId,
        payoutId: payout.id,
        note: `Payout ($${(payout.amount / 100).toFixed(2)}) has no confirmed payment`,
      });
    }
  }

  logger.info("[Reconciliation] reconcilePaymentsAndPayouts complete", { matched, orphanPayments, orphanPayouts, mismatches });
  return { matched, orphanPayments, orphanPayouts, mismatches, details };
}

// ── 9. Provider Re-verification ─────────────────────────────────

const REVERIFICATION_INTERVAL_DAYS = 365;

/**
 * Checks for provider onboarding steps that are due for re-verification.
 * Steps with completedAt older than REVERIFICATION_INTERVAL_DAYS get
 * their status reset to pending, triggering a new verification cycle.
 *
 * Applies to: identity_verification, background_check, insurance, certifications
 */
export async function checkProviderReverification(): Promise<{
  checked: number;
  resetCount: number;
}> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - REVERIFICATION_INTERVAL_DAYS * 24 * 60 * 60 * 1000);

  const reverifiableStepTypes = ["identity_verification", "background_check", "insurance", "certifications"];

  const overdueSteps = await db
    .select({
      step: onboardingSteps,
      providerName: providers.name,
    })
    .from(onboardingSteps)
    .innerJoin(providers, eq(onboardingSteps.providerId, providers.id))
    .where(
      and(
        eq(onboardingSteps.status, "complete"),
        lt(onboardingSteps.completedAt, cutoff),
        sql`${onboardingSteps.stepType} IN (${sql.join(reverifiableStepTypes.map((t) => sql`${t}`), sql`, `)})`,
        sql`${providers.status} NOT IN ('suspended', 'rejected', 'inactive')`,
      ),
    );

  let resetCount = 0;

  for (const { step } of overdueSteps) {
    try {
      const metadata = (step.metadata || {}) as Record<string, unknown>;

      await db
        .update(onboardingSteps)
        .set({
          status: "pending",
          completedAt: null,
          metadata: {
            ...metadata,
            reverificationDueAt: now.toISOString(),
            previousCompletedAt: step.completedAt?.toISOString(),
            reverificationCycle: ((metadata.reverificationCycle as number) || 0) + 1,
          },
          updatedAt: now,
        })
        .where(and(eq(onboardingSteps.id, step.id), eq(onboardingSteps.status, "complete")));

      logAudit({
        action: "onboarding.status_changed",
        resourceType: "onboarding_step",
        resourceId: step.id,
        details: {
          providerId: step.providerId,
          stepType: step.stepType,
          reason: "annual_reverification",
          previousCompletedAt: step.completedAt?.toISOString(),
        },
      });

      resetCount++;
    } catch (err) {
      logger.error("[Reconciliation] Re-verification reset failed", {
        stepId: step.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("[Reconciliation] checkProviderReverification complete", {
    checked: overdueSteps.length,
    resetCount,
  });

  return { checked: overdueSteps.length, resetCount };
}

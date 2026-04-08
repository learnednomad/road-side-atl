/**
 * Reconciliation stubs — placeholders for cron job imports.
 *
 * These functions are invoked by server/cron.ts on a schedule.
 * Each one will be implemented as its Epic is delivered:
 * - Checkr: Epic TBD (background check status sync)
 * - Stripe Connect: Epic TBD (onboarding status sync)
 * - Migration: Epic TBD (payment-method migration reminders)
 *
 * Stubs return a no-op result so the cron scheduler can run without errors.
 */

import { logger } from "@/lib/logger";

export async function reconcileCheckrStatuses(): Promise<{ reconciled: number }> {
  logger.info("[Reconciliation] reconcileCheckrStatuses — stub (not yet implemented)");
  return { reconciled: 0 };
}

export async function reconcileStripeConnectStatuses(): Promise<{ reconciled: number }> {
  logger.info("[Reconciliation] reconcileStripeConnectStatuses — stub (not yet implemented)");
  return { reconciled: 0 };
}

export async function checkStripeConnectAbandonment(): Promise<{ reminded: number }> {
  logger.info("[Reconciliation] checkStripeConnectAbandonment — stub (not yet implemented)");
  return { reminded: 0 };
}

export async function enforceStripeConnectDeadline(): Promise<{ enforced: number }> {
  logger.info("[Reconciliation] enforceStripeConnectDeadline — stub (not yet implemented)");
  return { enforced: 0 };
}

export async function checkMigrationReminders(): Promise<{ reminded: number }> {
  logger.info("[Reconciliation] checkMigrationReminders — stub (not yet implemented)");
  return { reminded: 0 };
}

export async function enforceMigrationDeadline(): Promise<{ enforced: number }> {
  logger.info("[Reconciliation] enforceMigrationDeadline — stub (not yet implemented)");
  return { enforced: 0 };
}

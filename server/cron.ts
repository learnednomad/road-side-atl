/**
 * Automated reconciliation scheduler.
 * Replaces manual admin-triggered reconciliation with periodic cron jobs.
 *
 * Schedule:
 * - Checkr status reconciliation: every 1 hour
 * - Stripe Connect status reconciliation: every 4 hours
 * - Stripe Connect abandonment reminders: every 6 hours
 * - Stripe Connect deadline enforcement: daily at midnight
 */

import { logger } from "@/lib/logger";

interface CronJob {
  name: string;
  intervalMs: number;
  run: () => Promise<unknown>;
  timer?: ReturnType<typeof setInterval>;
}

const HOUR = 60 * 60 * 1000;

const jobs: CronJob[] = [
  {
    name: "reconcile-checkr",
    intervalMs: 1 * HOUR,
    run: async () => {
      const { reconcileCheckrStatuses } = await import("./api/lib/reconciliation");
      return reconcileCheckrStatuses();
    },
  },
  {
    name: "reconcile-stripe-connect",
    intervalMs: 4 * HOUR,
    run: async () => {
      const { reconcileStripeConnectStatuses } = await import("./api/lib/reconciliation");
      return reconcileStripeConnectStatuses();
    },
  },
  {
    name: "stripe-connect-abandonment",
    intervalMs: 6 * HOUR,
    run: async () => {
      const { checkStripeConnectAbandonment } = await import("./api/lib/reconciliation");
      return checkStripeConnectAbandonment();
    },
  },
  {
    name: "stripe-connect-deadline",
    intervalMs: 24 * HOUR,
    run: async () => {
      const { enforceStripeConnectDeadline } = await import("./api/lib/reconciliation");
      return enforceStripeConnectDeadline();
    },
  },
  {
    name: "migration-reminders",
    intervalMs: 6 * HOUR,
    run: async () => {
      const { checkMigrationReminders } = await import("./api/lib/reconciliation");
      return checkMigrationReminders();
    },
  },
  {
    name: "migration-deadline",
    intervalMs: 24 * HOUR,
    run: async () => {
      const { enforceMigrationDeadline } = await import("./api/lib/reconciliation");
      return enforceMigrationDeadline();
    },
  },
];

function runJob(job: CronJob) {
  job
    .run()
    .then((result) => {
      logger.info(`[Cron] ${job.name} completed`, result as Record<string, unknown>);
    })
    .catch((err) => {
      logger.error(`[Cron] ${job.name} failed`, err);
    });
}

export function startCronJobs() {
  if (process.env.DISABLE_CRON === "true") {
    logger.info("[Cron] Disabled via DISABLE_CRON env var");
    return;
  }

  logger.info("[Cron] Starting reconciliation scheduler", {
    jobs: jobs.map((j) => ({ name: j.name, intervalHours: j.intervalMs / HOUR })),
  });

  for (const job of jobs) {
    // Stagger initial runs to avoid thundering herd on startup
    const initialDelay = Math.random() * 60_000 + 10_000; // 10-70s after boot
    setTimeout(() => {
      runJob(job);
      job.timer = setInterval(() => runJob(job), job.intervalMs);
    }, initialDelay);
  }
}

export function stopCronJobs() {
  for (const job of jobs) {
    if (job.timer) {
      clearInterval(job.timer);
      job.timer = undefined;
    }
  }
  logger.info("[Cron] All cron jobs stopped");
}

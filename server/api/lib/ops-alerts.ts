/**
 * Slack ops alerts — structured, fail-open notifications for money/ops events.
 *
 * Addresses the audit's top blind spot ("no monitoring/alerting"). Posts to a
 * Slack Incoming Webhook (`SLACK_OPS_WEBHOOK_URL`). Design rules:
 *   - NO-OP if the webhook URL is unset (safe in dev/CI/local).
 *   - NEVER throws and NEVER awaits in a request path — it is fire-and-forget,
 *     so it can't block a Stripe webhook 200 or slow a booking.
 *   - Throttled by key so a storm of identical events doesn't spam the channel.
 *
 * No new runtime dependency — uses global fetch (Node 20+).
 */
import { logger } from "@/lib/logger";

export type OpsSeverity = "info" | "warning" | "critical";

const SEVERITY_EMOJI: Record<OpsSeverity, string> = {
  info: ":information_source:",
  warning: ":warning:",
  critical: ":rotating_light:",
};

// Throttle: key -> last-sent epoch ms. Bounded to avoid unbounded growth.
const lastSent = new Map<string, number>();
const MAX_THROTTLE_KEYS = 1000;

export interface OpsAlert {
  title: string;
  severity?: OpsSeverity;
  fields?: Record<string, string | number | null | undefined>;
  /** Dedupe key; identical keys within the window are suppressed. Defaults to title. */
  dedupeKey?: string;
  dedupeWindowMs?: number;
}

/**
 * Fire-and-forget a Slack ops alert. Returns immediately; the network call
 * happens in the background and any failure is logged, never thrown.
 */
export function sendOpsAlert(alert: OpsAlert): void {
  const url = process.env.SLACK_OPS_WEBHOOK_URL;
  if (!url) return;

  const severity = alert.severity ?? "info";
  const key = alert.dedupeKey ?? alert.title;
  const windowMs = alert.dedupeWindowMs ?? 60_000;
  const now = Date.now();

  const prev = lastSent.get(key);
  if (prev !== undefined && now - prev < windowMs) return;
  if (lastSent.size >= MAX_THROTTLE_KEYS) lastSent.clear();
  lastSent.set(key, now);

  const lines = Object.entries(alert.fields ?? {})
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `• *${k}:* ${v}`);
  const env = process.env.APP_ENV || process.env.NODE_ENV || "unknown";
  const text = `${SEVERITY_EMOJI[severity]} *${alert.title}*  _(${env})_${lines.length ? "\n" + lines.join("\n") : ""}`;

  // Fire-and-forget; swallow all errors.
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  }).catch((err) => {
    logger.error("[ops-alerts] Slack send failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

/** Test-only: reset the throttle window. */
export function __resetOpsAlertThrottle(): void {
  lastSent.clear();
}

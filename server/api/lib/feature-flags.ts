/**
 * Feature flags backed by the platform_settings table.
 *
 * Keys are stored as "feature:<flag_name>" in the DB.
 * Values are "true" or "false" strings.
 *
 * Includes an in-memory cache with TTL to avoid hitting DB on every check.
 * Admin endpoints allow toggling flags at runtime without deploy.
 */

import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

// ── Flag Definitions ────────────────────────────────────────────

export const FEATURE_FLAGS = {
  /** Enable Checkr background check API polling in reconciliation cron */
  CHECKR_RECONCILIATION: "feature:checkr_reconciliation",
  /** Enable Stripe Connect status reconciliation cron */
  STRIPE_CONNECT_RECONCILIATION: "feature:stripe_connect_reconciliation",
  /** Enable Stripe Connect abandonment reminders */
  STRIPE_CONNECT_ABANDONMENT: "feature:stripe_connect_abandonment",
  /** Enable Stripe Connect deadline enforcement (auto-suspend) */
  STRIPE_CONNECT_DEADLINE: "feature:stripe_connect_deadline",
  /** Enable migration reminders for manual_batch providers */
  MIGRATION_REMINDERS: "feature:migration_reminders",
  /** Enable migration deadline enforcement (auto-suspend) */
  MIGRATION_DEADLINE: "feature:migration_deadline",
  /** Enable destination charges (vs legacy platform charges) */
  DESTINATION_CHARGES: "feature:destination_charges",
  /** Enable dynamic surge pricing */
  SURGE_PRICING: "feature:surge_pricing",
  /** Enable Stripe Identity verification for providers */
  STRIPE_IDENTITY: "feature:stripe_identity",
  /** Enable instant payouts for providers */
  INSTANT_PAYOUTS: "feature:instant_payouts",
  /** Require identity verification for customer bookings above threshold */
  CUSTOMER_IDENTITY_VERIFICATION: "feature:customer_identity_verification",
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/** Default values — features are OFF by default until explicitly enabled */
const FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = {
  [FEATURE_FLAGS.CHECKR_RECONCILIATION]: false,
  [FEATURE_FLAGS.STRIPE_CONNECT_RECONCILIATION]: true,
  [FEATURE_FLAGS.STRIPE_CONNECT_ABANDONMENT]: true,
  [FEATURE_FLAGS.STRIPE_CONNECT_DEADLINE]: false,
  [FEATURE_FLAGS.MIGRATION_REMINDERS]: false,
  [FEATURE_FLAGS.MIGRATION_DEADLINE]: false,
  [FEATURE_FLAGS.DESTINATION_CHARGES]: true,
  [FEATURE_FLAGS.SURGE_PRICING]: false,
  [FEATURE_FLAGS.STRIPE_IDENTITY]: false,
  [FEATURE_FLAGS.INSTANT_PAYOUTS]: false,
  [FEATURE_FLAGS.CUSTOMER_IDENTITY_VERIFICATION]: false,
};

// ── Cache ───────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000; // 1 minute

interface CacheEntry {
  value: boolean;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(key: string): boolean | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCache(key: string, value: boolean): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Clear cache for a specific flag or all flags */
export function clearFlagCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Check if a feature flag is enabled.
 * Reads from cache first, falls back to DB, then to hardcoded defaults.
 */
export async function isFeatureEnabled(flag: FeatureFlagKey): Promise<boolean> {
  // Check cache first
  const cached = getCached(flag);
  if (cached !== undefined) return cached;

  try {
    const setting = await db.query.platformSettings.findFirst({
      where: eq(platformSettings.key, flag),
    });

    const value = setting ? setting.value === "true" : (FLAG_DEFAULTS[flag] ?? false);
    setCache(flag, value);
    return value;
  } catch (err) {
    logger.error("[FeatureFlags] DB read failed, using default", {
      flag,
      error: err instanceof Error ? err.message : String(err),
    });
    return FLAG_DEFAULTS[flag] ?? false;
  }
}

/**
 * Set a feature flag value. Creates the row if it doesn't exist.
 */
export async function setFeatureFlag(flag: FeatureFlagKey, enabled: boolean): Promise<void> {
  const value = enabled ? "true" : "false";

  const existing = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.key, flag),
  });

  if (existing) {
    await db
      .update(platformSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(platformSettings.key, flag));
  } else {
    await db.insert(platformSettings).values({ key: flag, value });
  }

  // Invalidate cache immediately
  clearFlagCache(flag);

  logger.info("[FeatureFlags] Flag updated", { flag, enabled });
}

/**
 * Get all feature flags with their current values.
 */
export async function getAllFeatureFlags(): Promise<
  Array<{ key: string; name: string; enabled: boolean; default: boolean }>
> {
  const flags = Object.entries(FEATURE_FLAGS);
  const results: Array<{ key: string; name: string; enabled: boolean; default: boolean }> = [];

  for (const [name, key] of flags) {
    const enabled = await isFeatureEnabled(key);
    results.push({
      key,
      name,
      enabled,
      default: FLAG_DEFAULTS[key] ?? false,
    });
  }

  return results;
}

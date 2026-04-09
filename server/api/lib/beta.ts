import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

let cachedBetaActive: boolean | null = null;
let cacheExpiry = 0;

/**
 * Check if beta mode is active via platform_settings.
 * Returns true if the "beta_active" key is set to "true".
 * Result is cached for 60 seconds to avoid repeated DB hits.
 */
export async function isBetaActive(): Promise<boolean> {
  if (cachedBetaActive !== null && Date.now() < cacheExpiry) return cachedBetaActive;
  const setting = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.key, "beta_active"),
  });
  cachedBetaActive = setting?.value === "true";
  cacheExpiry = Date.now() + 60_000;
  return cachedBetaActive;
}

/**
 * Clear the beta status cache. Call after admin toggle.
 */
export function clearBetaCache(): void {
  cachedBetaActive = null;
  cacheExpiry = 0;
}

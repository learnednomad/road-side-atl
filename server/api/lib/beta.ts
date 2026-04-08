import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Check if beta mode is active via platform_settings.
 * Returns true if the "beta_active" key is set to "true".
 */
export async function isBetaActive(): Promise<boolean> {
  const setting = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.key, "beta_active"),
  });
  return setting?.value === "true";
}

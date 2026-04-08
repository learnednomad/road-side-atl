import { db } from "@/db";
import { providerInviteTokens } from "@/db/schema/auth";
import { eq, and, lt } from "drizzle-orm";

/**
 * Expire pending invite tokens that have passed their expiry date.
 * Runs every 6 hours via cron.
 */
export async function expireInviteTokens(): Promise<{ expired: number }> {
  const result = await db
    .update(providerInviteTokens)
    .set({ status: "expired" })
    .where(
      and(
        eq(providerInviteTokens.status, "pending"),
        lt(providerInviteTokens.expires, new Date())
      )
    )
    .returning({ identifier: providerInviteTokens.identifier });

  return { expired: result.length };
}

/**
 * Loyalty points: earn 1 point per $1 of completed spend; redeem 1 point = 1
 * cent of discount. Ledger + users.loyaltyPoints stay in sync in one
 * transaction. Earn is idempotent per (user, booking).
 */
import { db } from "@/db";
import { loyaltyTransactions, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

/** Award earn points for a completed booking (fail-open, idempotent). */
export async function awardLoyaltyForBooking(
  userId: string,
  bookingId: string,
  amountCents: number,
): Promise<void> {
  const points = Math.floor(amountCents / 100);
  if (points <= 0) return;
  try {
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: loyaltyTransactions.id })
        .from(loyaltyTransactions)
        .where(and(eq(loyaltyTransactions.bookingId, bookingId), eq(loyaltyTransactions.type, "earn")))
        .limit(1);
      if (existing.length > 0) return; // already awarded for this booking
      const [u] = await tx
        .select({ balance: users.loyaltyPoints })
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      if (!u) return;
      await tx.insert(loyaltyTransactions).values({ userId, points, type: "earn", bookingId, notes: "Booking completed" });
      await tx.update(users).set({ loyaltyPoints: u.balance + points }).where(eq(users.id, userId));
    });
  } catch (err) {
    logger.error("[Loyalty] award failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

/** Redeem points → cents. Returns the cents applied, throws on insufficient balance. */
export async function redeemLoyalty(
  userId: string,
  points: number,
  bookingId: string,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [u] = await tx
      .select({ balance: users.loyaltyPoints })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    if (!u || u.balance < points) {
      throw new Error("Insufficient loyalty points");
    }
    await tx.insert(loyaltyTransactions).values({ userId, points: -points, type: "redeem", bookingId, notes: "Redeemed for discount" });
    await tx.update(users).set({ loyaltyPoints: u.balance - points }).where(eq(users.id, userId));
    return points; // 1 point = 1 cent
  });
}

/**
 * B2B NET credit-ledger adjustments for events AFTER booking creation.
 *
 * `createB2bBooking` posts the initial `charge` (= estimatedPrice) and bumps the
 * account balance. These helpers keep the ledger + balance correct when the
 * booking is later cancelled (reverse the accrual) or repriced (true up to the
 * final price). Both are:
 *   - **idempotent** — re-running is a no-op (they reconcile to a target net),
 *   - **safe for non-B2B / prepaid bookings** — a booking with no `charge` row
 *     produces no ledger movement, so callers can invoke them unconditionally.
 *
 * The append-only ledger invariant holds: sum(amountCents) for an account ==
 * b2b_accounts.currentBalanceCents, updated in the same locked transaction.
 */
import { db } from "@/db";
import { b2bAccounts, b2bCreditTransactions } from "@/db/schema";
import { eq } from "drizzle-orm";

type LedgerRow = { amountCents: number; type: string; accountId: string };

async function loadBookingLedger(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  bookingId: string,
): Promise<LedgerRow[]> {
  return tx
    .select({
      amountCents: b2bCreditTransactions.amountCents,
      type: b2bCreditTransactions.type,
      accountId: b2bCreditTransactions.accountId,
    })
    .from(b2bCreditTransactions)
    .where(eq(b2bCreditTransactions.bookingId, bookingId));
}

/**
 * Reverse all NET credit accrued to a booking when it is cancelled. No-op if the
 * booking never accrued credit (prepaid / non-B2B) or is already net-zero.
 */
export async function reverseB2bCreditForBooking(bookingId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await loadBookingLedger(tx, bookingId);
    if (!rows.some((r) => r.type === "charge")) return; // not a NET B2B booking
    const net = rows.reduce((s, r) => s + r.amountCents, 0);
    if (net === 0) return; // already reversed
    const accountId = rows[0]!.accountId;

    const [acct] = await tx
      .select({ balance: b2bAccounts.currentBalanceCents })
      .from(b2bAccounts)
      .where(eq(b2bAccounts.id, accountId))
      .for("update");
    if (!acct) return;

    await tx.insert(b2bCreditTransactions).values({
      accountId,
      type: "adjustment",
      amountCents: -net,
      bookingId,
      notes: `Reversal: booking ${bookingId} cancelled`,
    });
    await tx
      .update(b2bAccounts)
      .set({ currentBalanceCents: acct.balance - net, updatedAt: new Date() })
      .where(eq(b2bAccounts.id, accountId));
  });
}

/**
 * True up a booking's accrued credit to its final price after a reprice (admin
 * override or customer quote approval). The initial charge was estimatedPrice;
 * the monthly invoice bills finalPrice, so the ledger must match. No-op if the
 * booking never accrued credit or is already at the target.
 */
export async function adjustB2bCreditToFinalPrice(
  bookingId: string,
  finalPriceCents: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await loadBookingLedger(tx, bookingId);
    if (!rows.some((r) => r.type === "charge")) return; // not a NET B2B booking
    const net = rows.reduce((s, r) => s + r.amountCents, 0);
    const delta = finalPriceCents - net;
    if (delta === 0) return; // already at final price
    const accountId = rows[0]!.accountId;

    const [acct] = await tx
      .select({ balance: b2bAccounts.currentBalanceCents })
      .from(b2bAccounts)
      .where(eq(b2bAccounts.id, accountId))
      .for("update");
    if (!acct) return;

    await tx.insert(b2bCreditTransactions).values({
      accountId,
      type: "adjustment",
      amountCents: delta,
      bookingId,
      notes: `Final price adjustment for booking ${bookingId}`,
    });
    await tx
      .update(b2bAccounts)
      .set({ currentBalanceCents: acct.balance + delta, updatedAt: new Date() })
      .where(eq(b2bAccounts.id, accountId));
  });
}

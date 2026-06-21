/**
 * Stripe invoice.paid handler (registered in the 0c extension registry). When a
 * Stripe invoice carrying b2bAccountId metadata is paid, record a NET payment in
 * the credit ledger and pay down the account balance. Event-level dedup in
 * webhooks.ts prevents double-application.
 *
 * Fail-CLOSED on unexpected DB errors: the narrow outer catch re-throws anything
 * that is NOT a Postgres unique-violation (23505), so the caller never marks the
 * event processed and Stripe retries. A 23505 is a benign duplicate (a concurrent
 * redelivery beat us to the ledger insert) and is swallowed as a no-op.
 */
import type Stripe from "stripe";
import { db } from "@/db";
import { b2bAccounts, b2bCreditTransactions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { sendOpsAlert } from "../ops-alerts";

/** True for a Postgres unique-constraint violation (SQLSTATE 23505). */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

export async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const accountId = invoice.metadata?.b2bAccountId;
  const amount = invoice.amount_paid;
  if (!accountId || !amount) return; // not a B2B credit invoice

  try {
    await db.transaction(async (tx) => {
      const [acct] = await tx
        .select({ balance: b2bAccounts.currentBalanceCents })
        .from(b2bAccounts)
        .where(eq(b2bAccounts.id, accountId))
        .for("update");
      if (!acct) {
        // Money-integrity anomaly (#51): a paid invoice carries a b2bAccountId
        // but no such account exists. Do not silently drop a real payment.
        sendOpsAlert({
          title: "invoice.paid for missing B2B account",
          severity: "critical",
          fields: {
            invoiceId: invoice.id,
            b2bAccountId: accountId,
            amountCents: amount,
          },
          dedupeKey: `invoice-paid-missing-acct:${invoice.id}`,
        });
        return;
      }
      // Idempotency backstop: event-level dedup marks AFTER the handler, so a
      // concurrent redelivery could reach here twice. Skip if a payment for this
      // invoice is already recorded.
      const existing = await tx
        .select({ id: b2bCreditTransactions.id })
        .from(b2bCreditTransactions)
        .where(and(eq(b2bCreditTransactions.invoiceId, invoice.id), eq(b2bCreditTransactions.type, "payment")))
        .limit(1);
      if (existing.length > 0) return;
      await tx.insert(b2bCreditTransactions).values({
        accountId,
        type: "payment",
        amountCents: -amount,
        invoiceId: invoice.id,
        notes: `Stripe invoice ${invoice.id} paid`,
      });
      await tx
        .update(b2bAccounts)
        .set({ currentBalanceCents: acct.balance - amount, updatedAt: new Date() })
        .where(eq(b2bAccounts.id, accountId));
    });
  } catch (err) {
    // Benign duplicate (concurrent redelivery hit the unique backstop) → no-op.
    // Any OTHER error propagates so the event is NOT marked processed and Stripe
    // retries (fail-closed). Mirrors the core switch re-throw pattern at
    // webhooks.ts:311/:558. The dispatch in webhooks.ts emits the ops alert for
    // an unexpected handler throw (FIX-3), so it is intentionally not duplicated here.
    if (!isUniqueViolation(err)) throw err;
  }
}

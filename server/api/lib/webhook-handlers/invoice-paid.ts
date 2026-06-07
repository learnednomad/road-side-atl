/**
 * Stripe invoice.paid handler (registered in the 0c extension registry). When a
 * Stripe invoice carrying b2bAccountId metadata is paid, record a NET payment in
 * the credit ledger and pay down the account balance. Event-level dedup in
 * webhooks.ts prevents double-application. Fail-open: a B2B-credit failure must
 * not 500 the webhook.
 */
import type Stripe from "stripe";
import { db } from "@/db";
import { b2bAccounts, b2bCreditTransactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

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
      if (!acct) return;
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
    logger.error("[Webhook] invoice.paid B2B credit update failed", err as Record<string, unknown>);
  }
}

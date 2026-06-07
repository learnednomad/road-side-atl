/**
 * B2B account reporting — spend, booking mix, and AR snapshot. Shared by the
 * admin route and the self-service portal so both see identical numbers.
 */
import { db } from "@/db";
import { bookings, b2bAccounts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export interface B2bReport {
  bookingCount: number;
  totalSpendCents: number;
  byStatus: Record<string, { count: number; spendCents: number }>;
  arBalanceCents: number;
  creditLimitCents: number;
  availableCreditCents: number;
}

export async function buildB2bReport(accountId: string): Promise<B2bReport | null> {
  const account = await db.query.b2bAccounts.findFirst({ where: eq(b2bAccounts.id, accountId) });
  if (!account) return null;

  const rows = await db
    .select({
      status: bookings.status,
      count: sql<number>`count(*)::int`,
      spend: sql<number>`coalesce(sum(${bookings.estimatedPrice}), 0)::int`,
    })
    .from(bookings)
    .where(eq(bookings.tenantId, accountId))
    .groupBy(bookings.status);

  const byStatus: B2bReport["byStatus"] = {};
  let bookingCount = 0;
  let totalSpendCents = 0;
  for (const r of rows) {
    byStatus[r.status] = { count: r.count, spendCents: r.spend };
    bookingCount += r.count;
    totalSpendCents += r.spend;
  }

  return {
    bookingCount,
    totalSpendCents,
    byStatus,
    arBalanceCents: account.currentBalanceCents,
    creditLimitCents: account.creditLimitCents,
    availableCreditCents: Math.max(0, account.creditLimitCents - account.currentBalanceCents),
  };
}

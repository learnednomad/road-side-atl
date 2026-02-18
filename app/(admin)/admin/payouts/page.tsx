import { Metadata } from "next";
import { PayoutsTable } from "@/components/admin/payouts-table";
import { db } from "@/db";
import { providerPayouts, providers, bookings } from "@/db/schema";
import { eq, desc, sql, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payouts | Admin | RoadSide ATL",
};

export default async function AdminPayoutsPage() {
  const payouts = await db
    .select({
      payout: providerPayouts,
      provider: providers,
      booking: bookings,
    })
    .from(providerPayouts)
    .innerJoin(providers, eq(providerPayouts.providerId, providers.id))
    .innerJoin(bookings, eq(providerPayouts.bookingId, bookings.id))
    .orderBy(desc(providerPayouts.createdAt));

  const [summary] = await db
    .select({
      totalPending: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'pending' and ${providerPayouts.payoutType} = 'standard' then ${providerPayouts.amount} else 0 end), 0)`,
      totalPaid: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'paid' then ${providerPayouts.amount} else 0 end), 0)`,
      pendingCount: sql<number>`count(case when ${providerPayouts.status} = 'pending' and ${providerPayouts.payoutType} = 'standard' then 1 end)`,
      paidCount: sql<number>`count(case when ${providerPayouts.status} = 'paid' then 1 end)`,
      totalClawback: sql<number>`coalesce(sum(case when ${providerPayouts.payoutType} = 'clawback' and ${providerPayouts.status} = 'pending' then abs(${providerPayouts.amount}) else 0 end), 0)`,
      clawbackCount: sql<number>`count(case when ${providerPayouts.payoutType} = 'clawback' and ${providerPayouts.status} = 'pending' then 1 end)`,
    })
    .from(providerPayouts);

  const serializedPayouts = payouts.map((p) => ({
    payout: {
      ...p.payout,
      createdAt: p.payout.createdAt.toISOString(),
      paidAt: p.payout.paidAt?.toISOString() || null,
    },
    provider: { id: p.provider.id, name: p.provider.name },
    booking: { id: p.booking.id, contactName: p.booking.contactName },
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Payouts</h1>
      <PayoutsTable
        payouts={serializedPayouts}
        summary={{
          totalPending: Number(summary.totalPending),
          totalPaid: Number(summary.totalPaid),
          pendingCount: Number(summary.pendingCount),
          paidCount: Number(summary.paidCount),
          totalClawback: Number(summary.totalClawback),
          clawbackCount: Number(summary.clawbackCount),
        }}
      />
    </div>
  );
}

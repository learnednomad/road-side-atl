import { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { providers, providerPayouts, bookings } from "@/db/schema";
import { eq, desc, sql, count } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Provider Detail | Admin | RoadSide ATL",
};

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, id),
  });

  if (!provider) {
    notFound();
  }

  const [earningsSummary] = await db
    .select({
      totalEarned: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
      totalPaid: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'paid' then ${providerPayouts.amount} else 0 end), 0)`,
      totalPending: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'pending' then ${providerPayouts.amount} else 0 end), 0)`,
      payoutCount: count(),
    })
    .from(providerPayouts)
    .where(eq(providerPayouts.providerId, id));

  const payouts = await db
    .select({
      payout: providerPayouts,
      booking: bookings,
    })
    .from(providerPayouts)
    .innerJoin(bookings, eq(providerPayouts.bookingId, bookings.id))
    .where(eq(providerPayouts.providerId, id))
    .orderBy(desc(providerPayouts.createdAt));

  const statusVariant = {
    active: "default" as const,
    pending: "secondary" as const,
    inactive: "destructive" as const,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{provider.name}</h1>

      {/* Provider Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Provider Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{provider.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm font-medium">{provider.phone}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Commission</p>
              <p className="text-sm font-medium">
                {provider.commissionType === "flat_per_job"
                  ? `$${((provider.flatFeeAmount || 0) / 100).toFixed(2)}/job`
                  : `${(provider.commissionRate / 100).toFixed(0)}%`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={statusVariant[provider.status]}>
                {provider.status}
              </Badge>
            </div>
          </div>
          {provider.specialties && (provider.specialties as string[]).length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">Specialties</p>
              <div className="mt-1 flex gap-2">
                {(provider.specialties as string[]).map((s) => (
                  <Badge key={s} variant="outline">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Earnings Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatPrice(Number(earningsSummary.totalEarned))}
            </p>
            <p className="text-xs text-muted-foreground">
              {earningsSummary.payoutCount} job{earningsSummary.payoutCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Paid Out</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatPrice(Number(earningsSummary.totalPaid))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {formatPrice(Number(earningsSummary.totalPending))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No payouts yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map(({ payout, booking }) => (
                    <TableRow key={payout.id}>
                      <TableCell className="text-sm">
                        {payout.createdAt.toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {booking.contactName}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPrice(payout.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={payout.status === "paid" ? "default" : "secondary"}
                        >
                          {payout.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {payout.paidAt
                          ? payout.paidAt.toLocaleDateString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

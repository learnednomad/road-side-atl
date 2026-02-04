import { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { payments, bookings, services } from "@/db/schema";
import { eq, count, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Revenue | Admin | RoadSide ATL",
};

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function AdminRevenuePage() {
  const byMethod = await db
    .select({
      method: payments.method,
      total: sql<number>`coalesce(sum(${payments.amount}), 0)`,
      count: count(),
    })
    .from(payments)
    .where(eq(payments.status, "confirmed"))
    .groupBy(payments.method);

  const byService = await db
    .select({
      serviceName: services.name,
      total: sql<number>`coalesce(sum(${payments.amount}), 0)`,
      count: count(),
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(payments.status, "confirmed"))
    .groupBy(services.name);

  const grandTotal = byMethod.reduce((sum, row) => sum + Number(row.total), 0);
  const totalTx = byMethod.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Revenue</h1>

      {/* Totals */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatPrice(grandTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Total Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalTx}</p>
          </CardContent>
        </Card>
      </div>

      {/* By Payment Method */}
      <Card>
        <CardHeader>
          <CardTitle>By Payment Method</CardTitle>
        </CardHeader>
        <CardContent>
          {byMethod.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No confirmed payments yet.
            </p>
          ) : (
            <div className="space-y-3">
              {byMethod.map((row) => {
                const pct =
                  grandTotal > 0
                    ? ((Number(row.total) / grandTotal) * 100).toFixed(1)
                    : "0";
                return (
                  <div key={row.method}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium capitalize">
                        {row.method}
                      </span>
                      <span>
                        {formatPrice(Number(row.total))} ({row.count} tx)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* By Service */}
      <Card>
        <CardHeader>
          <CardTitle>By Service</CardTitle>
        </CardHeader>
        <CardContent>
          {byService.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No confirmed payments yet.
            </p>
          ) : (
            <div className="space-y-3">
              {byService.map((row) => {
                const pct =
                  grandTotal > 0
                    ? ((Number(row.total) / grandTotal) * 100).toFixed(1)
                    : "0";
                return (
                  <div key={row.serviceName}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">{row.serviceName}</span>
                      <span>
                        {formatPrice(Number(row.total))} ({row.count} tx)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { Metadata } from "next";
import { StatsCards } from "@/components/admin/stats-cards";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { bookings, services, payments } from "@/db/schema";
import { eq, desc, gte, count, sql, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Dashboard | RoadSide ATL",
};

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function AdminOverviewPage() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayBookings] = await db
    .select({ count: count() })
    .from(bookings)
    .where(gte(bookings.createdAt, todayStart));

  const [pendingBookings] = await db
    .select({ count: count() })
    .from(bookings)
    .where(eq(bookings.status, "pending"));

  const [weeklyRevenue] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(and(eq(payments.status, "confirmed"), gte(payments.createdAt, weekStart)));

  const [monthlyRevenue] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(and(eq(payments.status, "confirmed"), gte(payments.createdAt, monthStart)));

  const recentBookings = await db
    .select({ booking: bookings, service: services })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .orderBy(desc(bookings.createdAt))
    .limit(10);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <StatsCards
        todayBookings={todayBookings.count}
        pendingBookings={pendingBookings.count}
        weeklyRevenue={Number(weeklyRevenue.total)}
        monthlyRevenue={Number(monthlyRevenue.total)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Recent Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {recentBookings.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No bookings yet.
            </p>
          ) : (
            <div className="space-y-3">
              {recentBookings.map(({ booking, service }) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{booking.contactName}</p>
                    <p className="text-xs text-muted-foreground">
                      {service.name} &middot;{" "}
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {formatPrice(booking.estimatedPrice)}
                    </span>
                    <StatusBadge status={booking.status as any} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

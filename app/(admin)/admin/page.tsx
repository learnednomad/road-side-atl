import { Metadata } from "next";
import { AdminOverviewClient } from "./overview-client";
import { db } from "@/db";
import { bookings, services, payments } from "@/db/schema";
import { eq, desc, gte, count, sql, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Dashboard | RoadSide ATL",
};

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

  const serializedBookings = recentBookings.map(({ booking, service }) => ({
    booking: {
      ...booking,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
      scheduledAt: booking.scheduledAt?.toISOString() || null,
    },
    service,
  }));

  return (
    <AdminOverviewClient
      stats={{
        todayBookings: todayBookings.count,
        pendingBookings: pendingBookings.count,
        weeklyRevenue: Number(weeklyRevenue.total),
        monthlyRevenue: Number(monthlyRevenue.total),
      }}
      recentBookings={serializedBookings}
    />
  );
}

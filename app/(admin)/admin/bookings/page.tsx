import { Metadata } from "next";
import { BookingsTable } from "@/components/admin/bookings-table";
import { db } from "@/db";
import { bookings, services, payments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bookings | Admin | RoadSide ATL",
};

export default async function AdminBookingsPage() {
  const results = await db
    .select({
      booking: bookings,
      service: services,
      payment: payments,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(payments, eq(payments.bookingId, bookings.id))
    .orderBy(desc(bookings.createdAt));

  // Group payments by booking
  const bookingMap = new Map<
    string,
    { booking: any; service: any; payments: any[] }
  >();
  for (const row of results) {
    const existing = bookingMap.get(row.booking.id);
    if (existing) {
      if (row.payment) existing.payments.push(row.payment);
    } else {
      bookingMap.set(row.booking.id, {
        booking: {
          ...row.booking,
          scheduledAt: row.booking.scheduledAt?.toISOString() || null,
          createdAt: row.booking.createdAt.toISOString(),
          updatedAt: row.booking.updatedAt.toISOString(),
        },
        service: row.service,
        payments: row.payment ? [row.payment] : [],
      });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Bookings</h1>
      <BookingsTable bookings={Array.from(bookingMap.values())} />
    </div>
  );
}

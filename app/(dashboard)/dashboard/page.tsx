import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BookingList } from "@/components/dashboard/booking-list";
import { db } from "@/db";
import { bookings, services } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Bookings | RoadSide ATL",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userBookings = await db
    .select({
      booking: bookings,
      service: services,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(bookings.userId, session.user.id))
    .orderBy(desc(bookings.createdAt));

  // Serialize dates for client component
  const serialized = userBookings.map((row) => ({
    booking: {
      ...row.booking,
      scheduledAt: row.booking.scheduledAt?.toISOString() || null,
      createdAt: row.booking.createdAt.toISOString(),
      updatedAt: row.booking.updatedAt.toISOString(),
    },
    service: row.service,
  }));

  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold">My Bookings</h1>
      <p className="mb-8 text-muted-foreground">
        View and manage your service bookings.
      </p>
      <BookingList bookings={serialized as any} />
    </div>
  );
}

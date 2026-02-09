import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { bookings, services, payments, providers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { MyBookingsClient } from "./my-bookings-client";

export default async function MyBookingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/my-bookings");
  }

  // Fetch user's bookings with related data
  const userBookings = await db
    .select({
      booking: bookings,
      service: services,
      provider: providers,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(providers, eq(bookings.providerId, providers.id))
    .where(eq(bookings.userId, session.user.id))
    .orderBy(desc(bookings.createdAt));

  // Fetch payments for all bookings
  const bookingIds = userBookings.map((b) => b.booking.id);
  const bookingPayments =
    bookingIds.length > 0
      ? await db.select().from(payments).where(eq(payments.status, "confirmed"))
      : [];

  // Map payments to bookings
  const paymentMap = new Map<string, typeof bookingPayments>();
  for (const payment of bookingPayments) {
    if (!paymentMap.has(payment.bookingId)) {
      paymentMap.set(payment.bookingId, []);
    }
    paymentMap.get(payment.bookingId)!.push(payment);
  }

  // Serialize data for client component
  const serializedBookings = userBookings.map(({ booking, service, provider }) => ({
    booking: {
      id: booking.id,
      status: booking.status,
      contactName: booking.contactName,
      contactPhone: booking.contactPhone,
      contactEmail: booking.contactEmail,
      vehicleInfo: booking.vehicleInfo,
      location: booking.location,
      estimatedPrice: booking.estimatedPrice,
      finalPrice: booking.finalPrice,
      towingMiles: booking.towingMiles,
      notes: booking.notes,
      createdAt: booking.createdAt.toISOString(),
      scheduledAt: booking.scheduledAt?.toISOString() || null,
    },
    service: {
      id: service.id,
      name: service.name,
      slug: service.slug,
      category: service.category,
    },
    provider: provider
      ? {
          id: provider.id,
          name: provider.name,
          phone: provider.phone,
        }
      : null,
    payments: (paymentMap.get(booking.id) || []).map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      status: p.status,
      confirmedAt: p.confirmedAt?.toISOString() || null,
    })),
  }));

  return (
    <div className="min-h-screen bg-muted/30 py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">My Bookings</h1>
          <p className="text-muted-foreground mt-2">
            Track your service requests and view booking history
          </p>
        </div>
        <MyBookingsClient initialBookings={serializedBookings} userId={session.user.id} />
      </div>
    </div>
  );
}

import { db } from "@/db";
import { bookings, services, providers, reviews } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { TrackingClient } from "./tracking-client";

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, id),
  });

  if (!booking) {
    notFound();
  }

  const service = await db.query.services.findFirst({
    where: eq(services.id, booking.serviceId),
  });

  let provider = null;
  if (booking.providerId) {
    provider = await db.query.providers.findFirst({
      where: eq(providers.id, booking.providerId),
    });
  }

  // Check if a review already exists for this booking
  const existingReview = await db.query.reviews.findFirst({
    where: eq(reviews.bookingId, id),
  });

  return (
    <TrackingClient
      booking={{
        id: booking.id,
        status: booking.status,
        serviceName: service?.name || "Service",
        vehicleInfo: booking.vehicleInfo,
        location: booking.location,
        contactName: booking.contactName,
        estimatedPrice: booking.estimatedPrice,
        createdAt: booking.createdAt.toISOString(),
        scheduledAt: booking.scheduledAt?.toISOString() || null,
      }}
      provider={
        provider
          ? {
              id: provider.id,
              name: provider.name,
              phone: provider.phone,
              rating: provider.averageRating ?? null,
              photoUrl: null,
              currentLocation: provider.currentLocation,
            }
          : null
      }
      hasReview={!!existingReview}
    />
  );
}

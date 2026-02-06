import { db } from "@/db";
import { bookings, providers, services, dispatchLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateDistance, milesToMeters } from "@/lib/distance";

const MAX_DISPATCH_DISTANCE_MILES = parseInt(
  process.env.MAX_DISPATCH_DISTANCE_MILES || "50"
);

interface DispatchResult {
  success: boolean;
  providerId?: string;
  providerName?: string;
  distanceMiles?: number;
  reason?: string;
}

export async function autoDispatchBooking(bookingId: string): Promise<DispatchResult> {
  if (process.env.AUTO_DISPATCH_ENABLED !== "true") {
    return { success: false, reason: "Auto-dispatch disabled" };
  }

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });

  if (!booking) {
    return { success: false, reason: "Booking not found" };
  }

  const location = booking.location as {
    latitude?: number;
    longitude?: number;
    address: string;
  };

  if (!location.latitude || !location.longitude) {
    return { success: false, reason: "Booking has no coordinates" };
  }

  const service = await db.query.services.findFirst({
    where: eq(services.id, booking.serviceId),
  });

  const activeProviders = await db
    .select()
    .from(providers)
    .where(
      and(
        eq(providers.status, "active"),
        eq(providers.isAvailable, true)
      )
    );

  if (activeProviders.length === 0) {
    return { success: false, reason: "No available providers" };
  }

  const candidates = activeProviders
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => {
      const distanceMiles = calculateDistance(
        { latitude: location.latitude!, longitude: location.longitude! },
        { latitude: p.latitude!, longitude: p.longitude! }
      );
      const specialties = (p.specialties as string[]) || [];
      const specialtyMatch = service ? specialties.includes(service.category) : false;
      return {
        providerId: p.id,
        name: p.name,
        distanceMiles: Math.round(distanceMiles * 10) / 10,
        specialtyMatch,
      };
    })
    .filter((c) => c.distanceMiles <= MAX_DISPATCH_DISTANCE_MILES)
    .sort((a, b) => {
      if (a.specialtyMatch && !b.specialtyMatch) return -1;
      if (!a.specialtyMatch && b.specialtyMatch) return 1;
      return a.distanceMiles - b.distanceMiles;
    });

  if (candidates.length === 0) {
    await db.insert(dispatchLogs).values({
      bookingId,
      algorithm: "auto",
      candidateProviders: [],
      reason: "No providers within range",
    });
    return { success: false, reason: "No providers within range" };
  }

  const best = candidates[0];

  await db
    .update(bookings)
    .set({
      providerId: best.providerId,
      status: "dispatched",
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId));

  await db.insert(dispatchLogs).values({
    bookingId,
    assignedProviderId: best.providerId,
    algorithm: "auto",
    distanceMeters: milesToMeters(best.distanceMiles),
    candidateProviders: candidates,
    reason: `Assigned to ${best.name} (${best.distanceMiles} mi, specialty: ${best.specialtyMatch})`,
  });

  return {
    success: true,
    providerId: best.providerId,
    providerName: best.name,
    distanceMiles: best.distanceMiles,
  };
}

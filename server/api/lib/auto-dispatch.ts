import { db } from "@/db";
import { bookings, providers, services, dispatchLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateDistance, milesToMeters } from "@/lib/distance";
import { DEFAULT_DISPATCH_RADIUS_MILES, EXPANDED_DISPATCH_RADIUS_MILES } from "@/lib/constants";
import { notifyProviderAssigned } from "@/lib/notifications";
import { broadcastToProvider, broadcastToAdmins } from "@/server/websocket/broadcast";

const MAX_DISPATCH_DISTANCE_MILES = parseInt(
  process.env.MAX_DISPATCH_DISTANCE_MILES || String(DEFAULT_DISPATCH_RADIUS_MILES)
);

const EXPANDED_RADIUS = parseInt(
  process.env.MAX_EXPANDED_RADIUS_MILES || String(EXPANDED_DISPATCH_RADIUS_MILES)
);

interface DispatchOptions {
  excludeProviderIds?: string[];
}

interface DispatchResult {
  success: boolean;
  providerId?: string;
  providerName?: string;
  distanceMiles?: number;
  expandedSearch?: boolean;
  reason?: string;
}

export async function autoDispatchBooking(
  bookingId: string,
  options?: DispatchOptions
): Promise<DispatchResult> {
  if (process.env.AUTO_DISPATCH_ENABLED !== "true") {
    return { success: false, reason: "Auto-dispatch disabled" };
  }

  const excludeIds = options?.excludeProviderIds || [];

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

  const isB2B = booking.tenantId != null;

  function buildCandidates(maxDistance: number) {
    return activeProviders
      .filter((p) => p.latitude != null && p.longitude != null)
      .filter((p) => !excludeIds.includes(p.id))
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
      .filter((c) => c.distanceMiles <= maxDistance)
      .sort((a, b) => {
        if (isB2B) {
          // B2B priority: specialty match first, then distance
          if (a.specialtyMatch && !b.specialtyMatch) return -1;
          if (!a.specialtyMatch && b.specialtyMatch) return 1;
        }
        return a.distanceMiles - b.distanceMiles;
      });
  }

  let candidates = buildCandidates(MAX_DISPATCH_DISTANCE_MILES);
  let expandedSearch = false;

  // Radius expansion: if no candidates at default radius, try expanded range
  if (candidates.length === 0) {
    candidates = buildCandidates(EXPANDED_RADIUS);
    if (candidates.length > 0) {
      expandedSearch = true;
    }
  }

  if (candidates.length === 0) {
    const reason = excludeIds.length > 0
      ? `No remaining providers within range (${excludeIds.length} previously attempted)`
      : "No providers within range";
    await db.insert(dispatchLogs).values({
      bookingId,
      algorithm: "auto",
      candidateProviders: [],
      reason,
    });
    return { success: false, reason };
  }

  const best = candidates[0];
  const assignedProvider = activeProviders.find((p) => p.id === best.providerId)!;

  await db
    .update(bookings)
    .set({
      providerId: best.providerId,
      status: "dispatched",
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId));

  const dispatchReason = [
    `Assigned to ${best.name} (${best.distanceMiles} mi, specialty: ${best.specialtyMatch})`,
    expandedSearch ? "(expanded radius)" : null,
    isB2B ? "(B2B priority)" : null,
    excludeIds.length > 0 ? `(cascade: ${excludeIds.length} excluded)` : null,
  ].filter(Boolean).join(" ");

  await db.insert(dispatchLogs).values({
    bookingId,
    assignedProviderId: best.providerId,
    algorithm: "auto",
    distanceMeters: milesToMeters(best.distanceMiles),
    candidateProviders: candidates,
    reason: dispatchReason,
  });

  // Provider notification (matching admin.ts assign-provider pattern)
  const estimatedPrice = booking.estimatedPrice || 0;
  let estimatedPayout = 0;
  if (assignedProvider.commissionType === "flat_per_job") {
    estimatedPayout = assignedProvider.flatFeeAmount || 0;
  } else if (service && service.commissionRate > 0) {
    const platformCut = Math.round(estimatedPrice * service.commissionRate / 10000);
    estimatedPayout = estimatedPrice - platformCut;
  } else {
    estimatedPayout = Math.round(estimatedPrice * assignedProvider.commissionRate / 10000);
  }

  notifyProviderAssigned(booking, assignedProvider, estimatedPrice, estimatedPayout).catch(() => {});
  if (assignedProvider.userId) {
    broadcastToProvider(assignedProvider.userId, {
      type: "provider:job_assigned",
      data: {
        bookingId,
        providerId: assignedProvider.id,
        contactName: booking.contactName,
        address: location.address,
        serviceName: service?.name,
        estimatedPrice,
        estimatedPayout,
      },
    });
  }
  broadcastToAdmins({ type: "booking:status_changed", data: { bookingId, status: "dispatched" } });

  return {
    success: true,
    providerId: best.providerId,
    providerName: best.name,
    distanceMiles: best.distanceMiles,
    expandedSearch,
  };
}

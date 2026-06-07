/**
 * Shared B2B booking creation — pricing + geocode + insert + notify + dispatch.
 *
 * Extracted from the inline `POST /:id/bookings` handler so every B2B entry
 * point (single booking, bulk, recurring materializer, estimate→convert, the
 * future portal) creates bookings through ONE path. Caller is responsible for
 * validating input, loading the account/service, authz, and audit logging.
 */
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { TOWING_BASE_MILES, TOWING_PRICE_PER_MILE_CENTS } from "@/lib/constants";
import { calculateBookingPrice } from "@/server/api/lib/pricing-engine";
import { geocodeAddress } from "@/lib/geocoding";
import { notifyB2bServiceDispatched } from "@/lib/notifications";
import { broadcastToAdmins } from "@/server/websocket/broadcast";
import { autoDispatchBooking } from "./auto-dispatch";
import type { CreateB2bBookingInput } from "@/lib/validators";

type B2bAccount = { id: string; companyName: string };
type Service = { id: string; name: string; slug: string };

export interface B2bBookingResult {
  booking: typeof bookings.$inferSelect;
  pricing: Awaited<ReturnType<typeof calculateBookingPrice>>;
  dispatchResult: Awaited<ReturnType<typeof autoDispatchBooking>> | null;
}

/**
 * Create a single B2B booking (tenantId = account.id). Pure of HTTP concerns.
 */
export async function createB2bBooking(
  account: B2bAccount,
  service: Service,
  data: CreateB2bBookingInput,
): Promise<B2bBookingResult> {
  const pricing = await calculateBookingPrice(
    data.serviceId,
    data.scheduledAt ? new Date(data.scheduledAt) : null,
  );
  let estimatedPrice = pricing.finalPrice;
  let towingMiles: number | undefined;

  // Towing per-mile is ADDITIVE (not multiplied by time-block).
  if (service.slug === "towing" && data.location.estimatedMiles) {
    towingMiles = data.location.estimatedMiles;
    const extraMiles = Math.max(0, towingMiles - TOWING_BASE_MILES);
    estimatedPrice += extraMiles * TOWING_PRICE_PER_MILE_CENTS;
  }

  // Server-side geocoding fallback.
  const locationData = { ...data.location };
  if (!locationData.latitude || !locationData.longitude) {
    const geocoded = await geocodeAddress(locationData.address).catch(() => null);
    if (geocoded) {
      locationData.latitude = geocoded.latitude;
      locationData.longitude = geocoded.longitude;
      locationData.placeId = geocoded.placeId;
    }
  }
  if (locationData.destination && !locationData.destinationLatitude) {
    const geocoded = await geocodeAddress(locationData.destination).catch(() => null);
    if (geocoded) {
      locationData.destinationLatitude = geocoded.latitude;
      locationData.destinationLongitude = geocoded.longitude;
    }
  }

  const [booking] = await db
    .insert(bookings)
    .values({
      serviceId: data.serviceId,
      vehicleInfo: data.vehicleInfo,
      location: locationData,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      estimatedPrice,
      towingMiles,
      notes: data.notes,
      tenantId: account.id,
    })
    .returning();

  // Fire-and-forget B2B notification + admin broadcast.
  notifyB2bServiceDispatched(
    { name: data.contactName, email: data.contactEmail, phone: data.contactPhone },
    account.companyName,
    service.name,
    data.location.address,
  ).catch((err) => {
    console.error("[Notifications] Failed:", err);
  });
  broadcastToAdmins({
    type: "booking:created",
    data: {
      bookingId: booking.id,
      contactName: booking.contactName,
      status: booking.status,
      serviceName: service.name,
      b2bAccountId: account.id,
    },
  });

  // Auto-dispatch immediate (unscheduled) bookings.
  let dispatchResult: B2bBookingResult["dispatchResult"] = null;
  if (!booking.scheduledAt && process.env.AUTO_DISPATCH_ENABLED === "true") {
    dispatchResult = await autoDispatchBooking(booking.id).catch(() => null);
  }

  return { booking, pricing, dispatchResult };
}

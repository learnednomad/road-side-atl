/**
 * Shared B2B booking creation — pricing + geocode + insert + notify + dispatch.
 *
 * Extracted from the inline `POST /:id/bookings` handler so every B2B entry
 * point (single booking, bulk, recurring materializer, estimate→convert, the
 * future portal) creates bookings through ONE path. Caller is responsible for
 * validating input, loading the account/service, authz, and audit logging.
 */
import { db } from "@/db";
import { bookings, b2bPriceList, fleetVehicles } from "@/db/schema";
import type { B2bContract } from "@/db/schema/b2b-accounts";
import { and, eq } from "drizzle-orm";
import { TOWING_BASE_MILES, TOWING_PRICE_PER_MILE_CENTS } from "@/lib/constants";
import { calculateBookingPrice } from "@/server/api/lib/pricing-engine";
import { geocodeAddress } from "@/lib/geocoding";
import { notifyB2bServiceDispatched } from "@/lib/notifications";
import { broadcastToAdmins } from "@/server/websocket/broadcast";
import { autoDispatchBooking } from "./auto-dispatch";
import type { CreateB2bBookingInput } from "@/lib/validators";

type B2bAccount = {
  id: string;
  companyName: string;
  contract?: B2bContract | null;
  defaultDiscountBp?: number;
};
type Service = { id: string; name: string; slug: string };
export type B2bPricingSource = "retail" | "discount" | "contract" | "price_list";

export interface B2bBookingResult {
  booking: typeof bookings.$inferSelect;
  pricing: Awaited<ReturnType<typeof calculateBookingPrice>>;
  pricingSource: B2bPricingSource;
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
  let estimatedPrice = pricing.finalPrice; // retail base
  let pricingSource: B2bPricingSource = "retail";

  // Account pricing resolution (before towing additive):
  //   price_list  >  contract.perJobRateCents  >  defaultDiscountBp  >  retail
  const priceListEntry = await db.query.b2bPriceList.findFirst({
    where: and(eq(b2bPriceList.accountId, account.id), eq(b2bPriceList.serviceId, data.serviceId)),
  });
  if (priceListEntry) {
    estimatedPrice = priceListEntry.priceCents;
    pricingSource = "price_list";
  } else if (account.contract?.perJobRateCents != null) {
    estimatedPrice = account.contract.perJobRateCents;
    pricingSource = "contract";
  } else if ((account.defaultDiscountBp ?? 0) > 0) {
    estimatedPrice = Math.round((estimatedPrice * (10000 - (account.defaultDiscountBp ?? 0))) / 10000);
    pricingSource = "discount";
  }

  // Fleet vehicle: if booking against a saved vehicle (scoped to the account),
  // snapshot its details into vehicleInfo so the booking record stays stable.
  let vehicleInfo = data.vehicleInfo;
  let fleetVehicleId: string | undefined;
  if (data.fleetVehicleId) {
    const fv = await db.query.fleetVehicles.findFirst({
      where: and(eq(fleetVehicles.id, data.fleetVehicleId), eq(fleetVehicles.accountId, account.id)),
    });
    if (fv) {
      fleetVehicleId = fv.id;
      vehicleInfo = {
        year: fv.year != null ? String(fv.year) : "",
        make: fv.make,
        model: fv.model,
        color: fv.color ?? "",
      };
    }
  }

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
      vehicleInfo,
      fleetVehicleId,
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

  return { booking, pricing, pricingSource, dispatchResult };
}

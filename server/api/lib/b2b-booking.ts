/**
 * Shared B2B booking creation — pricing + geocode + insert + notify + dispatch.
 *
 * Extracted from the inline `POST /:id/bookings` handler so every B2B entry
 * point (single booking, bulk, recurring materializer, estimate→convert, the
 * future portal) creates bookings through ONE path. Caller is responsible for
 * validating input, loading the account/service, authz, and audit logging.
 */
import { db } from "@/db";
import { bookings, b2bPriceList, fleetVehicles, b2bAccounts, b2bCreditTransactions } from "@/db/schema";
import type { B2bContract } from "@/db/schema/b2b-accounts";
import { and, eq } from "drizzle-orm";

/** Thrown when a NET booking would exceed the account's credit limit. */
export class CreditLimitError extends Error {
  constructor(public readonly balanceCents: number, public readonly limitCents: number, public readonly chargeCents: number) {
    super(`Credit limit exceeded: balance ${balanceCents} + charge ${chargeCents} > limit ${limitCents}`);
    this.name = "CreditLimitError";
  }
}
import { TOWING_BASE_MILES, TOWING_PRICE_PER_MILE_CENTS } from "@/lib/constants";
import { calculateBookingPrice } from "@/server/api/lib/pricing-engine";
import { geocodeAddress } from "@/lib/geocoding";
import { notifyB2bServiceDispatched } from "@/lib/notifications";
import { broadcastToAdmins } from "@/server/websocket/broadcast";
import { autoDispatchBooking } from "./auto-dispatch";
import { emitPartnerEvent } from "./outbound-webhooks";
import type { CreateB2bBookingInput } from "@/lib/validators";

type B2bAccount = {
  id: string;
  companyName: string;
  contract?: B2bContract | null;
  defaultDiscountBp?: number;
  paymentTerms?: string;
  creditLimitCents?: number;
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
 * Resolve the account's per-unit price for a service (before any towing
 * additive): price_list > contract.perJobRateCents > defaultDiscountBp > retail.
 * SINGLE SOURCE used by both booking creation and estimate building so a quote
 * always matches what the booking will cost.
 */
export async function priceServiceForAccount(
  account: B2bAccount,
  serviceId: string,
  scheduledAt?: Date | null,
): Promise<{
  unitPriceCents: number;
  source: B2bPricingSource;
  pricing: Awaited<ReturnType<typeof calculateBookingPrice>>;
}> {
  const pricing = await calculateBookingPrice(serviceId, scheduledAt ?? null);
  let unitPriceCents = pricing.finalPrice;
  let source: B2bPricingSource = "retail";

  const priceListEntry = await db.query.b2bPriceList.findFirst({
    where: and(eq(b2bPriceList.accountId, account.id), eq(b2bPriceList.serviceId, serviceId)),
  });
  if (priceListEntry) {
    unitPriceCents = priceListEntry.priceCents;
    source = "price_list";
  } else if (account.contract?.perJobRateCents != null) {
    unitPriceCents = account.contract.perJobRateCents;
    source = "contract";
  } else if ((account.defaultDiscountBp ?? 0) > 0) {
    unitPriceCents = Math.round((unitPriceCents * (10000 - (account.defaultDiscountBp ?? 0))) / 10000);
    source = "discount";
  }
  return { unitPriceCents, source, pricing };
}

/**
 * Create a single B2B booking (tenantId = account.id). Pure of HTTP concerns.
 */
export async function createB2bBooking(
  account: B2bAccount,
  service: Service,
  data: CreateB2bBookingInput,
  opts?: { priceOverrideCents?: number },
): Promise<B2bBookingResult> {
  const { unitPriceCents, source, pricing } = await priceServiceForAccount(
    account,
    data.serviceId,
    data.scheduledAt ? new Date(data.scheduledAt) : null,
  );
  // A frozen quote price (estimate→convert) overrides live resolution so the
  // booking matches what was quoted (roadmap 1b).
  let estimatedPrice = opts?.priceOverrideCents ?? unitPriceCents;
  const pricingSource: B2bPricingSource = opts?.priceOverrideCents != null ? "price_list" : source;

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

  const bookingValues = {
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
    pricingSnapshot: {
      basePrice: pricing.basePrice,
      multiplier: pricing.multiplier,
      blockName: pricing.blockName ?? null,
      estimatedPrice,
      source: pricingSource,
    },
  };

  // NET accounts draw down credit: guard the limit + record a ledger charge +
  // bump the balance, all in one transaction with a locked balance read so
  // concurrent bookings can't blow past the limit. Prepaid accounts (no credit
  // limit) keep the plain insert — no behavior change.
  // Any non-prepaid account accrues AR (ledger + balance) so it can be invoiced.
  // The credit-limit ceiling is only ENFORCED when a positive limit is set
  // (limit 0 = "track, don't cap"); prepaid accounts keep the plain insert.
  const isNet = account.paymentTerms !== undefined && account.paymentTerms !== "prepaid";

  let booking: typeof bookings.$inferSelect;
  if (isNet) {
    booking = await db.transaction(async (tx) => {
      const [acct] = await tx
        .select({ balance: b2bAccounts.currentBalanceCents, limit: b2bAccounts.creditLimitCents })
        .from(b2bAccounts)
        .where(eq(b2bAccounts.id, account.id))
        .for("update");
      const balance = acct?.balance ?? 0;
      const limit = acct?.limit ?? 0;
      if (limit > 0 && balance + estimatedPrice > limit) {
        throw new CreditLimitError(balance, limit, estimatedPrice);
      }
      const [b] = await tx.insert(bookings).values(bookingValues).returning();
      await tx.insert(b2bCreditTransactions).values({
        accountId: account.id,
        type: "charge",
        amountCents: estimatedPrice,
        bookingId: b.id,
        notes: `Booking ${b.id}`,
      });
      await tx
        .update(b2bAccounts)
        .set({ currentBalanceCents: balance + estimatedPrice, updatedAt: new Date() })
        .where(eq(b2bAccounts.id, account.id));
      return b;
    });
  } else {
    [booking] = await db.insert(bookings).values(bookingValues).returning();
  }

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

  // Outbound partner webhook (fire-and-forget; enqueues to active subscriptions).
  void emitPartnerEvent(account.id, "booking.created", {
    bookingId: booking.id,
    serviceId: booking.serviceId,
    serviceName: service.name,
    status: booking.status,
    estimatedPrice: booking.estimatedPrice,
    scheduledAt: booking.scheduledAt,
  });

  // Auto-dispatch immediate (unscheduled) bookings.
  let dispatchResult: B2bBookingResult["dispatchResult"] = null;
  if (!booking.scheduledAt && process.env.AUTO_DISPATCH_ENABLED === "true") {
    dispatchResult = await autoDispatchBooking(booking.id).catch(() => null);
  }

  return { booking, pricing, pricingSource, dispatchResult };
}

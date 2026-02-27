import { db } from "@/db";
import { bookings, payments, providers, providerPayouts, services } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createInvoiceForBooking } from "./invoice-generator";

/**
 * Creates a payout record if the booking is eligible:
 * - booking is completed
 * - has a confirmed payment
 * - has an assigned provider
 * - no existing payout for this booking
 *
 * Payout calculation priority chain:
 * 1. Provider flat_per_job (special arrangement override)
 * 2. Service-level commission rate (standard)
 * 3. Provider-level commission rate (fallback)
 */
export async function createPayoutIfEligible(bookingId: string) {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });

  if (!booking || booking.status !== "completed" || !booking.providerId) {
    return null;
  }

  // Check for confirmed payment
  const confirmedPayment = await db.query.payments.findFirst({
    where: and(
      eq(payments.bookingId, bookingId),
      eq(payments.status, "confirmed")
    ),
  });

  if (!confirmedPayment) {
    return null;
  }

  // Check no existing payout
  const existingPayout = await db.query.providerPayouts.findFirst({
    where: eq(providerPayouts.bookingId, bookingId),
  });

  if (existingPayout) {
    return existingPayout;
  }

  // Get provider
  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, booking.providerId),
  });

  if (!provider) {
    return null;
  }

  // Get service for commission rate
  const service = await db.query.services.findFirst({
    where: eq(services.id, booking.serviceId),
  });

  // Determine effective booking price (override takes precedence)
  const effectivePrice = booking.priceOverrideCents ?? confirmedPayment.amount;

  // Calculate provider payout using priority chain:
  // 1. Provider flat_per_job (special arrangement)
  // 2. Service-level commission rate (standard)
  // 3. Provider-level commission rate (fallback)
  let providerAmount: number;

  if (provider.commissionType === "flat_per_job") {
    // Special provider arrangement: flat fee per job
    providerAmount = provider.flatFeeAmount || 0;
  } else if (service && service.commissionRate > 0) {
    // Service-level commission: commissionRate = platform's cut in basis points
    const platformCut = Math.round(effectivePrice * service.commissionRate / 10000);
    providerAmount = effectivePrice - platformCut;
  } else {
    // Fallback: provider-level commission (commissionRate = provider's share in basis points)
    providerAmount = Math.round((effectivePrice * provider.commissionRate) / 10000);
  }

  // Ensure provider amount is non-negative
  providerAmount = Math.max(0, providerAmount);

  const [payout] = await db
    .insert(providerPayouts)
    .values({
      providerId: provider.id,
      bookingId,
      amount: providerAmount,
      status: "pending",
    })
    .returning();

  // Generate invoice for this booking (fire-and-forget)
  createInvoiceForBooking(bookingId).catch((err) => {
    console.error("[Payout] Failed to generate invoice for booking:", bookingId, err);
  });

  return payout;
}

import { db } from "@/db";
import { bookings, payments, providers, providerPayouts } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Creates a payout record if the booking is eligible:
 * - booking is completed
 * - has a confirmed payment
 * - has an assigned provider
 * - no existing payout for this booking
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

  // Calculate commission
  const paymentAmount = confirmedPayment.amount;
  let providerAmount: number;

  if (provider.commissionType === "flat_per_job") {
    providerAmount = provider.flatFeeAmount || 0;
  } else {
    // percentage: commissionRate is in basis points (7000 = 70%)
    providerAmount = Math.round((paymentAmount * provider.commissionRate) / 10000);
  }

  const [payout] = await db
    .insert(providerPayouts)
    .values({
      providerId: provider.id,
      bookingId,
      amount: providerAmount,
      status: "pending",
    })
    .returning();

  return payout;
}

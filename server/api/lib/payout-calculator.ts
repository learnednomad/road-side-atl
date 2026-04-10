import { db } from "@/db";
import { bookings, payments, providers, providerPayouts, services } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";
import { createInvoiceForBooking } from "./invoice-generator";
import { logger } from "@/lib/logger";

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
 *
 * For destination charges (chargeType: "destination" in payment metadata),
 * the split already happened at charge time — we just record the payout as paid.
 * For legacy platform charges, we issue a Stripe Transfer if the provider has
 * a Connect account, otherwise queue for manual batch.
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

  // Determine if this was a destination charge (split already done at charge time)
  // We check the payment's Stripe session metadata for chargeType
  const isDestinationCharge = await checkIfDestinationCharge(confirmedPayment.stripeSessionId);

  if (isDestinationCharge) {
    // Destination charge: funds already split at charge time.
    // Record the payout as paid immediately — Stripe handled the transfer.
    const [payout] = await db
      .insert(providerPayouts)
      .values({
        providerId: provider.id,
        bookingId,
        amount: providerAmount,
        status: "paid",
        paidAt: new Date(),
        payoutMethod: "stripe_connect",
        metadata: { chargeType: "destination", stripeSessionId: confirmedPayment.stripeSessionId },
      })
      .returning();

    createInvoiceForBooking(bookingId).catch((err) => {
      console.error("[Payout] Failed to generate invoice for booking:", bookingId, err);
    });

    return payout;
  }

  // Legacy path: platform-side charge — issue transfer or queue for manual batch
  if (provider.stripeConnectAccountId) {
    return await createStripeConnectPayout(provider, booking, bookingId, providerAmount, confirmedPayment.id);
  }

  // No Connect account: queue for manual batch processing
  const [payout] = await db
    .insert(providerPayouts)
    .values({
      providerId: provider.id,
      bookingId,
      amount: providerAmount,
      status: "pending",
      payoutMethod: "manual_batch",
    })
    .returning();

  createInvoiceForBooking(bookingId).catch((err) => {
    console.error("[Payout] Failed to generate invoice for booking:", bookingId, err);
  });

  return payout;
}

/**
 * Check if a Checkout Session used destination charges by examining its metadata.
 */
async function checkIfDestinationCharge(stripeSessionId: string | null): Promise<boolean> {
  if (!stripeSessionId) return false;

  try {
    const session = await getStripe().checkout.sessions.retrieve(stripeSessionId);
    return session.metadata?.chargeType === "destination";
  } catch {
    return false;
  }
}

/**
 * Issue a Stripe Connect transfer for a legacy platform-side charge.
 * Falls back to manual_batch on failure.
 */
async function createStripeConnectPayout(
  provider: { id: string; stripeConnectAccountId: string | null },
  booking: { id: string },
  bookingId: string,
  providerAmount: number,
  paymentId: string,
) {
  // Create payout record first (pending)
  const [payout] = await db
    .insert(providerPayouts)
    .values({
      providerId: provider.id,
      bookingId,
      amount: providerAmount,
      status: "pending",
      payoutMethod: "stripe_connect",
      paymentId,
    })
    .returning();

  try {
    const transfer = await getStripe().transfers.create(
      {
        amount: providerAmount,
        currency: "usd",
        destination: provider.stripeConnectAccountId!,
        transfer_group: bookingId,
        metadata: { payoutId: payout.id, bookingId, providerId: provider.id },
      },
      { idempotencyKey: `payout-${payout.id}` },
    );

    // Mark as paid with transfer reference
    await db
      .update(providerPayouts)
      .set({
        status: "paid",
        paidAt: new Date(),
        stripeTransferId: transfer.id,
        metadata: { stripeTransferId: transfer.id },
      })
      .where(eq(providerPayouts.id, payout.id));

    logger.info("[Payout] Stripe Connect transfer created", {
      payoutId: payout.id,
      transferId: transfer.id,
      amount: providerAmount,
      providerId: provider.id,
    });
  } catch (err) {
    // Transfer failed — fall back to manual batch
    logger.error("[Payout] Stripe Connect transfer failed, falling back to manual_batch", {
      payoutId: payout.id,
      providerId: provider.id,
      error: err instanceof Error ? err.message : String(err),
    });

    await db
      .update(providerPayouts)
      .set({
        payoutMethod: "manual_batch",
        metadata: { transferError: err instanceof Error ? err.message : String(err) },
      })
      .where(eq(providerPayouts.id, payout.id));
  }

  createInvoiceForBooking(bookingId).catch((err) => {
    console.error("[Payout] Failed to generate invoice for booking:", bookingId, err);
  });

  return payout;
}

/**
 * Migrate pending manual_batch payouts to Stripe Connect transfers.
 * Called when a provider completes Stripe Connect onboarding.
 */
export async function migratePendingPayoutsToConnect(
  providerId: string
): Promise<{ migrated: number; errors: number }> {
  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, providerId),
    columns: { id: true, stripeConnectAccountId: true },
  });

  if (!provider?.stripeConnectAccountId) {
    logger.warn("[Payout] Cannot migrate payouts — provider has no Connect account", { providerId });
    return { migrated: 0, errors: 0 };
  }

  // Find all pending manual_batch payouts for this provider
  const pendingPayouts = await db.query.providerPayouts.findMany({
    where: and(
      eq(providerPayouts.providerId, providerId),
      eq(providerPayouts.status, "pending"),
      eq(providerPayouts.payoutMethod, "manual_batch"),
    ),
  });

  if (pendingPayouts.length === 0) {
    return { migrated: 0, errors: 0 };
  }

  let migrated = 0;
  let errors = 0;

  for (const payout of pendingPayouts) {
    try {
      const transfer = await getStripe().transfers.create(
        {
          amount: payout.amount,
          currency: "usd",
          destination: provider.stripeConnectAccountId,
          transfer_group: payout.bookingId,
          metadata: { payoutId: payout.id, bookingId: payout.bookingId, providerId },
        },
        { idempotencyKey: `payout-${payout.id}` },
      );

      await db
        .update(providerPayouts)
        .set({
          status: "paid",
          paidAt: new Date(),
          payoutMethod: "stripe_connect",
          stripeTransferId: transfer.id,
          metadata: { stripeTransferId: transfer.id, migratedFromManualBatch: true },
        })
        .where(eq(providerPayouts.id, payout.id));

      migrated++;
    } catch (err) {
      logger.error("[Payout] Migration transfer failed", {
        payoutId: payout.id,
        providerId,
        error: err instanceof Error ? err.message : String(err),
      });
      errors++;
    }
  }

  logger.info("[Payout] Migration complete", { providerId, migrated, errors, total: pendingPayouts.length });
  return { migrated, errors };
}

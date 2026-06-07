import { db } from "@/db";
import { bookings, payments, providers, providerPayouts, services } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

// System default provider share (basis points) — see providers.commissionRate.
// A provider whose rate differs from this has a deliberate special arrangement.
const DEFAULT_PROVIDER_COMMISSION_RATE = 7000;

/** True for a Postgres unique-constraint violation (SQLSTATE 23505). */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}
import { getStripe } from "@/lib/stripe";
import { createInvoiceForBooking } from "./invoice-generator";
import { logAudit } from "./audit-logger";
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
/**
 * Insert a standard payout, tolerating a concurrent insert. If the unique
 * "one standard payout per booking" index rejects it, return the row that won
 * the race instead of throwing. `created` tells the caller whether to run
 * one-time side effects (Stripe transfer, invoice generation).
 */
async function insertPayoutOrExisting(
  values: typeof providerPayouts.$inferInsert,
  bookingId: string
): Promise<{ payout: typeof providerPayouts.$inferSelect; created: boolean }> {
  try {
    const [payout] = await db.insert(providerPayouts).values(values).returning();
    return { payout, created: true };
  } catch (err) {
    if (isUniqueViolation(err)) {
      const existing = await db.query.providerPayouts.findFirst({
        where: and(
          eq(providerPayouts.bookingId, bookingId),
          sql`${providerPayouts.payoutType} = 'standard'`
        ),
      });
      if (existing) return { payout: existing, created: false };
    }
    throw err;
  }
}

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
    // Service-level commission (platform's cut, basis points) is authoritative.
    const serviceProviderAmount = effectivePrice - Math.round(effectivePrice * service.commissionRate / 10000);
    if (provider.commissionRate !== DEFAULT_PROVIDER_COMMISSION_RATE) {
      // Explicit special arrangement (e.g. beta provider at 8000 = 80% share)
      // overrides the service cut. Previously a Math.max made the provider's
      // default rate a payout *floor*, silently overpaying when a service's
      // platform cut exceeded 30% (M9).
      providerAmount = Math.round((effectivePrice * provider.commissionRate) / 10000);
    } else {
      providerAmount = serviceProviderAmount;
    }
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
    const { payout, created } = await insertPayoutOrExisting(
      {
        providerId: provider.id,
        bookingId,
        amount: providerAmount,
        status: "paid",
        paidAt: new Date(),
        payoutMethod: "stripe_connect",
        metadata: { chargeType: "destination", stripeSessionId: confirmedPayment.stripeSessionId },
      },
      bookingId,
    );

    if (created) {
      createInvoiceForBooking(bookingId).catch((err) => {
        console.error("[Payout] Failed to generate invoice for booking:", bookingId, err);
      });
    }

    return payout;
  }

  // Legacy path: platform-side charge — issue transfer or queue for manual batch
  if (provider.stripeConnectAccountId) {
    return await createStripeConnectPayout(provider, booking, bookingId, providerAmount, confirmedPayment.id);
  }

  // No Connect account: queue for manual batch processing
  const { payout, created } = await insertPayoutOrExisting(
    {
      providerId: provider.id,
      bookingId,
      amount: providerAmount,
      status: "pending",
      payoutMethod: "manual_batch",
    },
    bookingId,
  );

  if (created) {
    createInvoiceForBooking(bookingId).catch((err) => {
      console.error("[Payout] Failed to generate invoice for booking:", bookingId, err);
    });
  }

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
  // Create payout record first (pending). If a concurrent call already created
  // the standard payout, return it without issuing a second transfer.
  const { payout, created } = await insertPayoutOrExisting(
    {
      providerId: provider.id,
      bookingId,
      amount: providerAmount,
      status: "pending",
      payoutMethod: "stripe_connect",
      paymentId,
    },
    bookingId,
  );

  if (!created) {
    return payout;
  }

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
    logAudit({
      action: "payout.stripe_connect_transfer",
      resourceType: "payout",
      resourceId: payout.id,
      details: { transferId: transfer.id, amount: providerAmount, providerId: provider.id, bookingId },
    });
  } catch (err) {
    // Transfer failed — fall back to manual batch
    const stripeError = err instanceof Error ? err.message : String(err);
    logger.error("[Payout] Stripe Connect transfer failed, falling back to manual_batch", {
      payoutId: payout.id,
      providerId: provider.id,
      error: stripeError,
    });

    await db
      .update(providerPayouts)
      .set({
        payoutMethod: "manual_batch",
        metadata: { stripeError },
      })
      .where(eq(providerPayouts.id, payout.id));

    logAudit({
      action: "payout.stripe_connect_failed",
      resourceType: "payout",
      resourceId: payout.id,
      details: { providerId: provider.id, bookingId, stripeError },
    });
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
      logAudit({
        action: "payout.auto_migrated",
        resourceType: "payout",
        resourceId: payout.id,
        details: { transferId: transfer.id, amount: payout.amount, providerId },
      });
    } catch (err) {
      const stripeError = err instanceof Error ? err.message : String(err);
      logger.error("[Payout] Migration transfer failed", {
        payoutId: payout.id,
        providerId,
        error: stripeError,
      });
      logAudit({
        action: "payout.stripe_connect_failed",
        resourceType: "payout",
        resourceId: payout.id,
        details: { providerId, bookingId: payout.bookingId, stripeError, context: "migration" },
      });
      errors++;
    }
  }

  logger.info("[Payout] Migration complete", { providerId, migrated, errors, total: pendingPayouts.length });
  return { migrated, errors };
}

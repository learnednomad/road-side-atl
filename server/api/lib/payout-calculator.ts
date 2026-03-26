import { db } from "@/db";
import { bookings, payments, providers, providerPayouts, services } from "@/db/schema";
import { onboardingSteps } from "@/db/schema/onboarding-steps";
import { eq, and, sql } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { logAudit } from "./audit-logger";
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

  // Determine payout routing: Stripe Connect vs manual batch
  const stripeStep = await db.query.onboardingSteps.findFirst({
    where: and(
      eq(onboardingSteps.providerId, provider.id),
      eq(onboardingSteps.stepType, "stripe_connect"),
      eq(onboardingSteps.status, "complete"),
    ),
  });

  if (provider.stripeConnectAccountId && stripeStep) {
    // Route via Stripe Connect — attempt transfer
    try {
      const transfer = await stripe.transfers.create({
        amount: providerAmount,
        currency: "usd",
        destination: provider.stripeConnectAccountId,
        transfer_group: bookingId,
        metadata: { payoutId: payout.id, bookingId },
      });

      await db
        .update(providerPayouts)
        .set({
          status: "paid",
          paidAt: new Date(),
          payoutMethod: "stripe_connect",
          metadata: { stripeTransferId: transfer.id },
        })
        .where(eq(providerPayouts.id, payout.id));

      logAudit({
        action: "payout.stripe_connect_transfer",
        resourceType: "payout",
        resourceId: payout.id,
        details: {
          providerId: provider.id,
          bookingId,
          amount: providerAmount,
          stripeTransferId: transfer.id,
          destination: provider.stripeConnectAccountId,
        },
      });
    } catch (err) {
      // Fallback to manual batch on Stripe failure
      await db
        .update(providerPayouts)
        .set({
          payoutMethod: "manual_batch",
          metadata: { stripeError: err instanceof Error ? err.message : String(err) },
        })
        .where(eq(providerPayouts.id, payout.id));

      logAudit({
        action: "payout.stripe_connect_failed",
        resourceType: "payout",
        resourceId: payout.id,
        details: {
          providerId: provider.id,
          bookingId,
          amount: providerAmount,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  } else {
    // No Connect account — mark as manual batch
    await db
      .update(providerPayouts)
      .set({ payoutMethod: "manual_batch" })
      .where(eq(providerPayouts.id, payout.id));
  }

  // Generate invoice for this booking (fire-and-forget)
  createInvoiceForBooking(bookingId).catch((err) => {
    console.error("[Payout] Failed to generate invoice for booking:", bookingId, err);
  });

  return payout;
}

/**
 * Auto-migrate pending manual_batch payouts to Stripe Connect
 * when a provider completes their Connect setup.
 */
export async function migratePendingPayoutsToConnect(
  providerId: string,
): Promise<{ migrated: number; errors: number }> {
  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, providerId),
  });

  if (!provider?.stripeConnectAccountId) {
    return { migrated: 0, errors: 0 };
  }

  const pendingPayouts = await db
    .select()
    .from(providerPayouts)
    .where(
      and(
        eq(providerPayouts.providerId, providerId),
        eq(providerPayouts.status, "pending"),
        eq(providerPayouts.payoutMethod, "manual_batch"),
        eq(providerPayouts.payoutType, "standard"),
      ),
    );

  let migrated = 0;
  let errors = 0;

  for (const payout of pendingPayouts) {
    try {
      // TOCTOU guard: claim the payout before sending money
      const [claimed] = await db
        .update(providerPayouts)
        .set({
          payoutMethod: "stripe_connect",
          metadata: sql`coalesce(${providerPayouts.metadata}, '{}'::jsonb) || ${JSON.stringify({ migrationStartedAt: new Date().toISOString() })}::jsonb`,
        })
        .where(
          and(
            eq(providerPayouts.id, payout.id),
            eq(providerPayouts.status, "pending"),
            eq(providerPayouts.payoutMethod, "manual_batch"),
          ),
        )
        .returning();

      if (!claimed) {
        // Another process already claimed this payout
        continue;
      }

      const transfer = await stripe.transfers.create({
        amount: payout.amount,
        currency: "usd",
        destination: provider.stripeConnectAccountId!,
        transfer_group: payout.bookingId,
        metadata: { payoutId: payout.id, bookingId: payout.bookingId },
      }, {
        idempotencyKey: `migrate_${payout.id}`,
      });

      await db
        .update(providerPayouts)
        .set({
          status: "paid",
          paidAt: new Date(),
          metadata: sql`coalesce(${providerPayouts.metadata}, '{}'::jsonb) || ${JSON.stringify({ stripeTransferId: transfer.id })}::jsonb`,
        })
        .where(
          and(
            eq(providerPayouts.id, payout.id),
            eq(providerPayouts.status, "pending"),
          ),
        );

      logAudit({
        action: "payout.auto_migrated",
        resourceType: "payout",
        resourceId: payout.id,
        details: {
          providerId,
          bookingId: payout.bookingId,
          amount: payout.amount,
          stripeTransferId: transfer.id,
        },
      });

      migrated++;
    } catch (err) {
      errors++;
      logAudit({
        action: "payout.stripe_connect_failed",
        resourceType: "payout",
        resourceId: payout.id,
        details: {
          providerId,
          bookingId: payout.bookingId,
          amount: payout.amount,
          error: err instanceof Error ? err.message : String(err),
          source: "auto_migration",
        },
      });
      console.error(
        `[Payout] Auto-migration failed for payout ${payout.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { migrated, errors };
}

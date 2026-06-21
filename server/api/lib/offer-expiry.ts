/**
 * Offer Expiry Handler — Processes expired dispatch offers.
 *
 * Called every 15s by the cron scheduler when DISPATCH_OFFER_MODE=true.
 * Finds bookings where offerExpiresAt has passed, reverts them to "confirmed",
 * and cascades to the next ranked provider (up to MAX_DISPATCH_CASCADE_ATTEMPTS).
 */

import { db } from "@/db";
import { bookings, dispatchLogs } from "@/db/schema";
import { eq, and, isNotNull, lte } from "drizzle-orm";
import { MAX_DISPATCH_CASCADE_ATTEMPTS } from "@/lib/constants";
import { logger } from "@/lib/logger";

interface ExpiryResult {
  expired: number;
  redispatched: number;
  manualNeeded: number;
}

export async function processExpiredOffers(): Promise<ExpiryResult> {
  const result: ExpiryResult = { expired: 0, redispatched: 0, manualNeeded: 0 };

  // Find all bookings with expired offers
  const expiredBookings = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.status, "dispatched"),
        isNotNull(bookings.offerExpiresAt),
        lte(bookings.offerExpiresAt, new Date()),
      ),
    );

  if (expiredBookings.length === 0) return result;

  for (const booking of expiredBookings) {
    result.expired++;
    const expiredProviderId = booking.providerId;

    // Revert booking to "confirmed" — clear offer fields
    await db
      .update(bookings)
      .set({
        providerId: null,
        status: "confirmed",
        offerExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id));

    // Log expiry in dispatch_logs
    await db.insert(dispatchLogs).values({
      bookingId: booking.id,
      assignedProviderId: expiredProviderId,
      algorithm: "auto",
      reason: `Offer expired after 60s (attempt ${booking.dispatchAttempt})`,
      attemptNumber: booking.dispatchAttempt,
      outcome: "expired",
    });

    // Cascade or escalate
    if (booking.dispatchAttempt >= MAX_DISPATCH_CASCADE_ATTEMPTS) {
      result.manualNeeded++;
      logger.error("[OfferExpiry] All attempts exhausted", {
        bookingId: booking.id,
        attempts: booking.dispatchAttempt,
      });
    } else {
      // Build exclusion list from all previous dispatch attempts
      const previousDispatches = await db.query.dispatchLogs.findMany({
        where: eq(dispatchLogs.bookingId, booking.id),
      });
      const excludeProviderIds = previousDispatches
        .filter((d) => d.assignedProviderId)
        .map((d) => d.assignedProviderId!);

      // Cascade: import V2 dynamically to avoid circular dependency
      const { autoDispatchBookingV2 } = await import("./auto-dispatch-v2");
      const dispatchResult = await autoDispatchBookingV2(booking.id, {
        excludeProviderIds,
        attempt: booking.dispatchAttempt + 1,
      });

      if (dispatchResult.success) {
        result.redispatched++;
      } else {
        result.manualNeeded++;
        logger.error("[OfferExpiry] Cascade re-dispatch failed", {
          bookingId: booking.id,
          reason: dispatchResult.reason,
        });
      }
    }
  }

  if (result.expired > 0) {
    logger.info("[OfferExpiry] Processed expired offers", { ...result });
  }

  return result;
}

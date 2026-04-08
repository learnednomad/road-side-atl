/**
 * Mechanic Pre-Dispatch
 *
 * Finds mechanic bookings with scheduledAt within the next 2 hours that are
 * confirmed but not yet assigned to a provider, and dispatches them via the
 * existing autoDispatchBooking function.
 */

import { db } from "@/db";
import { bookings, services } from "@/db/schema";
import { eq, and, isNull, gte, lte } from "drizzle-orm";
import { autoDispatchBooking } from "./auto-dispatch";
import { broadcastToAdmins } from "@/server/websocket/broadcast";
import { logger } from "@/lib/logger";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

interface PreDispatchResult {
  scanned: number;
  mechanicEligible: number;
  dispatched: number;
  failed: number;
}

export async function findAndDispatchMechanicBookings(): Promise<PreDispatchResult> {
  const now = new Date();
  const twoHoursFromNow = new Date(Date.now() + TWO_HOURS_MS);

  // Query confirmed bookings with no provider, scheduledAt within the next 2 hours
  const pendingBookings = await db
    .select({
      booking: bookings,
      service: services,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(
      and(
        eq(bookings.status, "confirmed"),
        isNull(bookings.providerId),
        gte(bookings.scheduledAt, now),
        lte(bookings.scheduledAt, twoHoursFromNow),
      ),
    );

  // Filter to mechanics category only
  const mechanicBookings = pendingBookings.filter(
    (row) => row.service.category === "mechanics",
  );

  let dispatched = 0;
  let failed = 0;

  for (const row of mechanicBookings) {
    const result = await autoDispatchBooking(row.booking.id).catch((err) => {
      logger.error(
        `[Mechanic Dispatch] Failed for booking ${row.booking.id}`,
        err,
      );
      return { success: false as const, reason: String(err) };
    });

    if (result.success) {
      dispatched++;
    } else {
      failed++;
      broadcastToAdmins({
        type: "booking:dispatch_failed",
        data: {
          bookingId: row.booking.id,
          reason: result.reason,
        },
      });
    }
  }

  return {
    scanned: pendingBookings.length,
    mechanicEligible: mechanicBookings.length,
    dispatched,
    failed,
  };
}

/**
 * Materializer for recurring B2B booking schedules. Run on a cron; for each
 * schedule whose nextRunAt is due, atomically claim the slot (advance nextRunAt
 * with an optimistic WHERE so overlapping runs can't double-create), then create
 * the booking through the shared createB2bBooking path.
 */
import { db } from "@/db";
import { recurringBookingSchedules, b2bAccounts, services } from "@/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { createB2bBooking } from "./b2b-booking";
import { logger } from "@/lib/logger";

type Frequency = "daily" | "weekly" | "monthly";

export function advanceDate(from: Date, frequency: Frequency, intervalCount: number): Date {
  const d = new Date(from);
  if (frequency === "daily") d.setDate(d.getDate() + intervalCount);
  else if (frequency === "weekly") d.setDate(d.getDate() + 7 * intervalCount);
  else d.setMonth(d.getMonth() + intervalCount); // monthly
  return d;
}

export async function materializeRecurringBookings(now: Date = new Date()): Promise<{
  due: number;
  created: number;
}> {
  const due = await db
    .select()
    .from(recurringBookingSchedules)
    .where(and(eq(recurringBookingSchedules.active, true), lte(recurringBookingSchedules.nextRunAt, now)));

  let created = 0;
  for (const sched of due) {
    const next = advanceDate(sched.nextRunAt, sched.frequency as Frequency, sched.intervalCount);
    // Atomically claim this run by advancing nextRunAt only if unchanged.
    const [claimed] = await db
      .update(recurringBookingSchedules)
      .set({ nextRunAt: next, lastRunAt: now, updatedAt: now })
      .where(and(eq(recurringBookingSchedules.id, sched.id), eq(recurringBookingSchedules.nextRunAt, sched.nextRunAt)))
      .returning();
    if (!claimed) continue; // another run claimed it

    try {
      const account = await db.query.b2bAccounts.findFirst({ where: eq(b2bAccounts.id, sched.accountId) });
      if (!account || account.status === "suspended") continue;
      const service = await db.query.services.findFirst({ where: eq(services.id, sched.serviceId) });
      if (!service) continue;
      await createB2bBooking(account, service, {
        serviceId: sched.serviceId,
        vehicleInfo: sched.template.vehicleInfo,
        location: sched.template.location as never,
        contactName: sched.template.contactName,
        contactPhone: sched.template.contactPhone,
        contactEmail: sched.template.contactEmail,
        fleetVehicleId: sched.template.fleetVehicleId ?? undefined,
        notes: sched.template.notes ?? `Recurring schedule ${sched.id}`,
      });
      created++;
    } catch (err) {
      logger.error(`[Recurring] failed to materialize schedule ${sched.id}`, err as Record<string, unknown>);
    }
  }
  return { due: due.length, created };
}

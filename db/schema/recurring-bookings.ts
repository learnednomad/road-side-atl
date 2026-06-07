import { pgTable, text, integer, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { b2bAccounts } from "./b2b-accounts";

export const recurringFrequencyEnum = pgEnum("recurring_frequency", [
  "daily",
  "weekly",
  "monthly",
]);

export type RecurringBookingTemplate = {
  location: Record<string, unknown> & { address: string };
  vehicleInfo: { year: string; make: string; model: string; color: string };
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  fleetVehicleId?: string | null;
  notes?: string;
};

/**
 * Recurring B2B booking schedule. A cron materializer creates a booking each
 * time nextRunAt is due, then advances it by frequency × intervalCount. The
 * advance is claimed atomically (UPDATE ... WHERE nextRunAt = expected) so
 * overlapping runs can't double-create.
 */
export const recurringBookingSchedules = pgTable("recurring_booking_schedules", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  accountId: text("accountId")
    .notNull()
    .references(() => b2bAccounts.id, { onDelete: "cascade" }),
  serviceId: text("serviceId").notNull(),
  template: jsonb("template").$type<RecurringBookingTemplate>().notNull(),
  frequency: recurringFrequencyEnum("frequency").notNull(),
  intervalCount: integer("intervalCount").notNull().default(1), // every N periods
  nextRunAt: timestamp("nextRunAt", { mode: "date" }).notNull(),
  lastRunAt: timestamp("lastRunAt", { mode: "date" }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

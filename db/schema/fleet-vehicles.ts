import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { b2bAccounts } from "./b2b-accounts";

/**
 * Fleet vehicles owned by a B2B account. A booking may reference one
 * (bookings.fleetVehicleId); the booking still snapshots vehicleInfo at creation
 * so historical records are stable even if the fleet record changes/deletes.
 */
export const fleetVehicles = pgTable("fleet_vehicles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  accountId: text("accountId")
    .notNull()
    .references(() => b2bAccounts.id, { onDelete: "cascade" }),
  label: text("label"), // e.g. "Van 12" / unit number
  year: integer("year"),
  make: text("make").notNull(),
  model: text("model").notNull(),
  color: text("color"),
  vin: text("vin"),
  licensePlate: text("licensePlate"),
  notes: text("notes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

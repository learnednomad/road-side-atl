import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createId } from "./utils";

/**
 * Surge pricing configuration per zone (or global if zoneId is null).
 * When booking rate exceeds threshold, surge multiplier activates.
 */
export const surgeConfigs = pgTable("surge_configs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  zoneId: text("zoneId"), // nullable = global config
  thresholdBookingsPerHour: integer("thresholdBookingsPerHour").notNull().default(10),
  multiplierStepBp: integer("multiplierStepBp").notNull().default(500), // basis points per booking above threshold (500 = 5%)
  maxMultiplierBp: integer("maxMultiplierBp").notNull().default(30000), // max surge = 3.0x (30000 BP)
  cooldownMinutes: integer("cooldownMinutes").notNull().default(30),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

/**
 * Audit log for every pricing adjustment applied to a booking.
 * Captures what multipliers were applied and why.
 */
export const pricingAdjustmentsLog = pgTable("pricing_adjustments_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  bookingId: text("bookingId").notNull(),
  adjustmentType: text("adjustmentType").notNull(), // "time_block" | "surge" | "weather" | "zone" | "promotion"
  multiplierBp: integer("multiplierBp").notNull(), // basis points applied
  reason: text("reason").notNull(), // human-readable explanation
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

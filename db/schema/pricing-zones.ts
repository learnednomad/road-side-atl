import { pgTable, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createId } from "./utils";

/**
 * Geographic pricing zones with GeoJSON polygon boundaries.
 * Each zone has a base multiplier applied to bookings within it.
 */
export const pricingZones = pgTable("pricing_zones", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  polygon: jsonb("polygon").$type<Array<{ lat: number; lng: number }>>().notNull(),
  baseMultiplierBp: integer("baseMultiplierBp").notNull().default(10000), // basis points (10000 = 1.0x)
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

/**
 * Promotion codes backed by Stripe Coupons.
 * Tracks platform-side metadata for admin management.
 */
export const promotions = pgTable("promotions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  stripeCouponId: text("stripeCouponId").notNull(),
  stripePromotionCodeId: text("stripePromotionCodeId"),
  code: text("code").notNull().unique(),
  description: text("description"),
  discountType: text("discountType").notNull(), // "percent" | "fixed"
  discountAmount: integer("discountAmount").notNull(), // percentage (e.g., 10 = 10%) or cents
  maxRedemptions: integer("maxRedemptions"),
  currentRedemptions: integer("currentRedemptions").default(0).notNull(),
  expiresAt: timestamp("expiresAt", { mode: "date" }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

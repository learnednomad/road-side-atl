import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { users } from "./users";
import { services } from "./services";

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "dispatched",
  "in_progress",
  "completed",
  "cancelled",
]);

/**
 * Immutable record of how a booking's price was derived (roadmap 1b). Frozen at
 * creation so quote→booking conversion and later reads don't drift if rates,
 * surge, or account terms change. Commission/payout fields are added by the
 * payout path when the provider is known.
 */
export type PricingSnapshot = {
  basePrice: number;
  multiplier: number;
  blockName: string | null;
  estimatedPrice: number;
  source: string; // retail | discount | contract | price_list
  estimateMinCents?: number | null;
  estimateMaxCents?: number | null;
};

export const bookings = pgTable("bookings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("userId").references(() => users.id, { onDelete: "set null" }),
  serviceId: text("serviceId")
    .notNull()
    .references(() => services.id),
  status: bookingStatusEnum("status").default("pending").notNull(),
  vehicleInfo: jsonb("vehicleInfo")
    .$type<{
      year: string;
      make: string;
      model: string;
      color: string;
    }>()
    .notNull(),
  location: jsonb("location")
    .$type<{
      address: string;
      latitude?: number;
      longitude?: number;
      placeId?: string;
      notes?: string;
      destination?: string;
      destinationLatitude?: number;
      destinationLongitude?: number;
      estimatedMiles?: number;
    }>()
    .notNull(),
  contactName: text("contactName").notNull(),
  contactPhone: text("contactPhone").notNull(),
  contactEmail: text("contactEmail").notNull(),
  scheduledAt: timestamp("scheduledAt", { mode: "date" }),
  estimatedPrice: integer("estimatedPrice").notNull(), // cents
  finalPrice: integer("finalPrice"), // cents
  towingMiles: integer("towingMiles"),
  referralCreditApplied: integer("referralCreditApplied"), // cents, nullable
  priceOverrideCents: integer("priceOverrideCents"), // cents, nullable — admin override
  priceOverrideReason: text("priceOverrideReason"), // nullable — required when override is set
  notes: text("notes"),
  preferredPaymentMethod: text("preferredPaymentMethod"),
  providerId: text("providerId"), // FK to providers, managed at app level to avoid circular imports
  fleetVehicleId: text("fleetVehicleId"), // FK to fleet_vehicles (B2B), app-level ref
  bundleId: text("bundleId"), // FK to service_bundles (B2C), app-level ref
  pricingSnapshot: jsonb("pricingSnapshot").$type<PricingSnapshot | null>().default(null),
  tenantId: text("tenantId"),
  offerExpiresAt: timestamp("offerExpiresAt", { mode: "date" }), // V2 dispatch: when current offer expires (null = no active offer)
  dispatchAttempt: integer("dispatchAttempt").default(0).notNull(), // V2 dispatch: cascade attempt counter
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

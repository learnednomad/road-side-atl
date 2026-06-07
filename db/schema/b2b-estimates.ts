import { pgTable, text, integer, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { b2bAccounts } from "./b2b-accounts";

export const b2bEstimateStatusEnum = pgEnum("b2b_estimate_status", [
  "draft",
  "approved",
  "converted",
  "expired",
]);

export type B2bEstimateLine = {
  serviceId: string;
  serviceName: string;
  qty: number;
  unitPriceCents: number; // account-resolved unit price
  source: string; // pricing source: retail|discount|contract|price_list
  lineMinCents: number; // estimate band * qty
  lineMaxCents: number;
  fleetVehicleId?: string | null;
};

/**
 * A B2B estimate / quote — account-priced line items (using the same resolution
 * as bookings) with an Atlanta-band range, a lifecycle, and a convert-to-bookings
 * action. Note: prices are recomputed at convert time (the immutable pricing
 * snapshot is roadmap Phase 1b); a validUntil bounds quote drift meanwhile.
 */
export const b2bEstimates = pgTable("b2b_estimates", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  accountId: text("accountId")
    .notNull()
    .references(() => b2bAccounts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: b2bEstimateStatusEnum("status").notNull().default("draft"),
  lines: jsonb("lines").$type<B2bEstimateLine[]>().notNull().default([]),
  subtotalCents: integer("subtotalCents").notNull().default(0),
  estMinCents: integer("estMinCents").notNull().default(0),
  estMaxCents: integer("estMaxCents").notNull().default(0),
  notes: text("notes"),
  validUntil: timestamp("validUntil", { mode: "date" }),
  convertedBookingIds: jsonb("convertedBookingIds").$type<string[]>().notNull().default([]),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

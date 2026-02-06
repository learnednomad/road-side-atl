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
  notes: text("notes"),
  providerId: text("providerId"), // FK to providers, managed at app level to avoid circular imports
  tenantId: text("tenantId"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

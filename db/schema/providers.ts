import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  real,
  boolean,
} from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { users } from "./users";

export const providerStatusEnum = pgEnum("provider_status", [
  "active",
  "inactive",
  "pending",
]);

export const commissionTypeEnum = pgEnum("commission_type", [
  "percentage",
  "flat_per_job",
]);

export const providers = pgTable("providers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("userId").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  commissionRate: integer("commissionRate").notNull().default(7000), // basis points (7000 = 70%)
  commissionType: commissionTypeEnum("commissionType")
    .notNull()
    .default("percentage"),
  flatFeeAmount: integer("flatFeeAmount"), // cents, for flat_per_job type
  status: providerStatusEnum("status").notNull().default("pending"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  address: text("address"),
  isAvailable: boolean("is_available").default(true).notNull(),
  currentLocation: jsonb("currentLocation").$type<{ lat: number; lng: number; updatedAt: string }>(),
  lastLocationUpdate: timestamp("lastLocationUpdate", { mode: "date" }),
  specialties: jsonb("specialties").$type<string[]>().default([]),
  averageRating: real("average_rating"),
  reviewCount: integer("review_count").default(0).notNull(),
  tenantId: text("tenantId"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

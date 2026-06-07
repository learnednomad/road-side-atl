import { pgTable, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { users } from "./users";

export const membershipIntervalEnum = pgEnum("membership_interval", ["month", "year"]);
export const membershipStatusEnum = pgEnum("membership_status", [
  "active",
  "past_due",
  "canceled",
]);

/** A purchasable membership plan (backed by a Stripe recurring Price). */
export const membershipPlans = pgTable("membership_plans", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  priceCents: integer("priceCents").notNull(),
  interval: membershipIntervalEnum("interval").notNull().default("month"),
  discountBp: integer("discountBp").notNull().default(0), // member booking discount, basis points
  priorityDispatch: boolean("priorityDispatch").notNull().default(false),
  stripePriceId: text("stripePriceId").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

/** A user's membership (one active per user). */
export const memberships = pgTable("memberships", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  planId: text("planId").notNull(), // app-level ref to membership_plans
  status: membershipStatusEnum("status").notNull().default("active"),
  stripeSubscriptionId: text("stripeSubscriptionId").unique(),
  currentPeriodEnd: timestamp("currentPeriodEnd", { mode: "date" }),
  discountBp: integer("discountBp").notNull().default(0), // snapshot of plan discount
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

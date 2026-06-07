import { pgTable, text, integer, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { b2bAccounts } from "./b2b-accounts";

export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "pending",
  "delivered",
  "failed", // dead-lettered after max attempts
]);

/**
 * Outbound webhook subscriptions — a B2B partner registers a URL to receive
 * signed event callbacks (booking.created, etc.). Deliveries are enqueued by
 * emitPartnerEvent and sent by a cron worker with HMAC signing + retry/backoff.
 */
export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  accountId: text("accountId")
    .notNull()
    .references(() => b2bAccounts.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(), // HMAC-SHA256 signing key
  events: jsonb("events").$type<string[]>().notNull().default([]), // subscribed event types
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  subscriptionId: text("subscriptionId")
    .notNull()
    .references(() => webhookSubscriptions.id, { onDelete: "cascade" }),
  eventType: text("eventType").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: webhookDeliveryStatusEnum("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("lastError"),
  nextAttemptAt: timestamp("nextAttemptAt", { mode: "date" }).defaultNow().notNull(),
  deliveredAt: timestamp("deliveredAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

/**
 * Persistent record of processed webhook events, for idempotency that survives
 * restarts and is shared across instances (replaces the per-process in-memory
 * Sets). Keyed by (source, id) — the provider's event id.
 */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: text("id").notNull(), // provider event id (Stripe evt_..., Checkr uuid)
    source: text("source").notNull(), // "stripe" | "checkr"
    eventType: text("eventType"), // e.g. checkout.session.completed (observability)
    status: text("status").notNull().default("processed"), // processed | skipped | failed
    processedAt: timestamp("processedAt", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.source, t.id] }),
  })
);

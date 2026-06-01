import { pgTable, text, integer, timestamp, jsonb, pgEnum, real } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { bookings } from "./bookings";
import { providers } from "./providers";

export const dispatchAlgorithmEnum = pgEnum("dispatch_algorithm", ["auto", "manual"]);

export const dispatchLogs = pgTable("dispatch_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  bookingId: text("bookingId")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  assignedProviderId: text("assignedProviderId").references(() => providers.id, {
    onDelete: "set null",
  }),
  algorithm: dispatchAlgorithmEnum("algorithm").notNull(),
  distanceMeters: integer("distanceMeters"),
  candidateProviders: jsonb("candidateProviders").$type<
    Array<{ providerId: string; name: string; distanceMiles: number; specialtyMatch: boolean; score?: number }>
  >(),
  reason: text("reason"),
  score: real("score"), // V2: composite score of selected provider
  attemptNumber: integer("attemptNumber"), // V2: cascade attempt (1, 2, 3)
  outcome: text("outcome"), // V2: "accepted" | "rejected" | "expired" | "assigned"
  scoringWeights: jsonb("scoringWeights").$type<Record<string, number>>(), // V2: weights used for scoring
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

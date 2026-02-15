import {
  pgTable,
  text,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { bookings } from "./bookings";

export type ObservationItem = {
  category: string;
  description: string;
  severity: "low" | "medium" | "high";
  photoUrl?: string;
};

export const observations = pgTable("observations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  bookingId: text("bookingId")
    .notNull()
    .references(() => bookings.id),
  providerId: text("providerId").notNull(),
  items: jsonb("items").$type<ObservationItem[]>().notNull(),
  followUpSent: boolean("followUpSent").default(false).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

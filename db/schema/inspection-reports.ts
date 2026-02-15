import {
  pgTable,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { bookings } from "./bookings";

export type InspectionFinding = {
  category: string;
  component: string;
  condition: "good" | "fair" | "poor" | "critical";
  description: string;
  measurement?: string;
  photoUrl?: string;
  obdCode?: string;
};

export const inspectionReports = pgTable("inspection_reports", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  bookingId: text("bookingId")
    .notNull()
    .references(() => bookings.id),
  providerId: text("providerId").notNull(),
  findings: jsonb("findings").$type<InspectionFinding[]>().notNull(),
  reportUrl: text("reportUrl"),
  emailedAt: timestamp("emailedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

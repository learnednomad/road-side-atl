import {
  pgTable,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { users } from "./users";
import { bookings } from "./bookings";

export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "credited",
  "expired",
]);

export const referrals = pgTable("referrals", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  referrerId: text("referrerId")
    .notNull()
    .references(() => users.id),
  refereeId: text("refereeId").references(() => users.id),
  bookingId: text("bookingId").references(() => bookings.id),
  creditAmount: integer("creditAmount").notNull(), // cents
  status: referralStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

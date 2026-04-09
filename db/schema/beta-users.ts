import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { users } from "./users";

export const betaUsers = pgTable("beta_users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  source: text("source").notNull(), // e.g. "booking", "manual"
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

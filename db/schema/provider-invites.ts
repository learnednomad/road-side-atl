import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "./utils";

export const providerInvites = pgTable("provider_invites", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  email: text("email").notNull(),
  name: text("name").notNull(),
  token: text("token").notNull().unique(),
  createdBy: text("createdBy").notNull(),
  usedAt: timestamp("usedAt", { mode: "date" }),
  expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

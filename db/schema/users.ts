import { pgTable, text, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { createId } from "./utils";

export const userRoleEnum = pgEnum("user_role", ["customer", "admin", "provider"]);

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  phone: text("phone"),
  password: text("password"),
  role: userRoleEnum("role").default("customer").notNull(),
  tenantId: text("tenantId"),
  trustTier: integer("trustTier").default(1).notNull(),
  cleanTransactionCount: integer("cleanTransactionCount").default(0).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

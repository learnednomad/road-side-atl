import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "./utils";

export const userRoleEnum = pgEnum("user_role", ["customer", "admin"]);

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  phone: text("phone"),
  role: userRoleEnum("role").default("customer").notNull(),
  tenantId: text("tenantId"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

import { pgTable, text, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { b2bAccounts } from "./b2b-accounts";
import { users } from "./users";

export const b2bMemberRoleEnum = pgEnum("b2b_member_role", [
  "owner", // full control incl. members
  "manager", // manage bookings/estimates/vehicles, no member admin
  "member", // create bookings/estimates, read-only otherwise
]);

/**
 * Links a platform user to a B2B account with a role. Membership is how the
 * self-service portal authorizes access — every portal query is scoped to the
 * member's accountId (never a client-supplied id).
 */
export const b2bAccountMembers = pgTable("b2b_account_members", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  accountId: text("accountId")
    .notNull()
    .references(() => b2bAccounts.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: b2bMemberRoleEnum("role").notNull().default("member"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
  uniqAccountUser: uniqueIndex("uniq_b2b_member_account_user").on(t.accountId, t.userId),
}));

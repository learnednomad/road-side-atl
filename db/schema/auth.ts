import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import { users } from "./users";
import { providers } from "./providers";

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (prt) => [primaryKey({ columns: [prt.identifier, prt.token] })]
);

export const providerInviteStatusEnum = pgEnum("provider_invite_status", [
  "pending",
  "accepted",
  "expired",
]);

export const providerInviteTokens = pgTable(
  "provider_invite_tokens",
  {
    identifier: text("identifier").notNull(), // email
    token: text("token").notNull(),
    providerId: text("providerId")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    invitedBy: text("invitedBy").references(() => users.id, {
      onDelete: "set null",
    }),
    status: providerInviteStatusEnum("status").notNull().default("pending"),
    expires: timestamp("expires", { mode: "date" }).notNull(),
    acceptedAt: timestamp("acceptedAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  (pit) => [primaryKey({ columns: [pit.identifier, pit.token] })]
);

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createId } from "./utils";

export const b2bAccountStatusEnum = pgEnum("b2b_account_status", [
  "pending",
  "active",
  "suspended",
]);

export const b2bPaymentTermsEnum = pgEnum("b2b_payment_terms", [
  "prepaid",
  "net_30",
  "net_60",
]);

export type BillingAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

export type B2bContract = {
  retainerAmountCents: number;
  perJobRateCents: number | null;
  includedServiceIds: string[];
  startDate: string;
  endDate: string;
};

export const b2bAccounts = pgTable("b2b_accounts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  companyName: text("companyName").notNull(),
  contactName: text("contactName").notNull(),
  contactEmail: text("contactEmail").notNull(),
  contactPhone: text("contactPhone").notNull(),
  billingAddress: jsonb("billingAddress").$type<BillingAddress>().notNull(),
  paymentTerms: b2bPaymentTermsEnum("paymentTerms").notNull().default("net_30"),
  status: b2bAccountStatusEnum("status").notNull().default("active"),
  contract: jsonb("contract").$type<B2bContract | null>().default(null),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

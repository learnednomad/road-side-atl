import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createId } from "./utils";
import { services } from "./services";

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

export const b2bPricingModeEnum = pgEnum("b2b_pricing_mode", [
  "retail", // standard retail pricing
  "discount", // apply defaultDiscountBp off retail
  "price_list", // negotiated per-service price list (falls back to discount/retail)
  "contract", // flat contract.perJobRateCents
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
  // Account pricing + credit (Phase 3b)
  accountNumber: text("accountNumber"), // human-friendly e.g. B2B-000123 (unique)
  pricingMode: b2bPricingModeEnum("pricingMode").notNull().default("retail"),
  defaultDiscountBp: integer("defaultDiscountBp").notNull().default(0), // basis points off retail
  commissionRateBp: integer("commissionRateBp"), // optional per-account platform cut override
  creditLimitCents: integer("creditLimitCents").notNull().default(0), // 0 = no NET credit
  currentBalanceCents: integer("currentBalanceCents").notNull().default(0), // outstanding NET balance
  notes: text("notes"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
  uniqAccountNumber: uniqueIndex("uniq_b2b_account_number")
    .on(t.accountNumber)
    .where(sql`${t.accountNumber} IS NOT NULL`),
}));

/**
 * Per-account negotiated price list — overrides retail for specific services.
 * Resolution order at quote time: price_list > contract.perJobRateCents >
 * defaultDiscountBp > retail (towing per-mile is added on top in all cases).
 */
export const b2bPriceList = pgTable("b2b_price_list", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  accountId: text("accountId")
    .notNull()
    .references(() => b2bAccounts.id, { onDelete: "cascade" }),
  serviceId: text("serviceId")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  priceCents: integer("priceCents").notNull(), // negotiated flat price for this service
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
  uniqAccountService: uniqueIndex("uniq_b2b_price_list_account_service").on(t.accountId, t.serviceId),
}));

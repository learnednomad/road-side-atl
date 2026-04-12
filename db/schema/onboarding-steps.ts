import {
  pgTable,
  text,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { providers } from "./providers";

export const stepTypeEnum = pgEnum("step_type", [
  "background_check",
  "insurance",
  "certifications",
  "training",
  "stripe_connect",
  "identity_verification",
]);

export const stepStatusEnum = pgEnum("step_status", [
  "pending",
  "draft",
  "in_progress",
  "pending_review",
  "complete",
  "rejected",
  "blocked",
]);

export const onboardingSteps = pgTable("onboarding_steps", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  providerId: text("providerId")
    .notNull()
    .references(() => providers.id),
  stepType: stepTypeEnum("stepType").notNull(),
  status: stepStatusEnum("status").notNull().default("pending"),
  draftData: jsonb("draftData").$type<Record<string, unknown>>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  completedAt: timestamp("completedAt", { mode: "date" }),
  reviewedBy: text("reviewedBy"),
  reviewedAt: timestamp("reviewedAt", { mode: "date" }),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

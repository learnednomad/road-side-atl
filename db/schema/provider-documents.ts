import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { providers } from "./providers";
import { onboardingSteps } from "./onboarding-steps";

export const documentTypeEnum = pgEnum("document_type", [
  "insurance",
  "certification",
  "vehicle_doc",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "pending_review",
  "approved",
  "rejected",
]);

export const providerDocuments = pgTable("provider_documents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  providerId: text("providerId")
    .notNull()
    .references(() => providers.id),
  onboardingStepId: text("onboardingStepId")
    .notNull()
    .references(() => onboardingSteps.id),
  documentType: documentTypeEnum("documentType").notNull(),
  s3Key: text("s3Key").notNull(),
  originalFileName: text("originalFileName").notNull(),
  fileSize: integer("fileSize").notNull(),
  mimeType: text("mimeType").notNull(),
  status: documentStatusEnum("status").notNull().default("pending_review"),
  rejectionReason: text("rejectionReason"),
  reviewedBy: text("reviewedBy"),
  reviewedAt: timestamp("reviewedAt", { mode: "date" }),
  expiresAt: timestamp("expiresAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

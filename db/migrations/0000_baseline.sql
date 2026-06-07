CREATE TYPE "public"."user_role" AS ENUM('customer', 'admin', 'provider');--> statement-breakpoint
CREATE TYPE "public"."scheduling_mode" AS ENUM('immediate', 'scheduled', 'both');--> statement-breakpoint
CREATE TYPE "public"."service_category" AS ENUM('roadside', 'diagnostics', 'mechanics');--> statement-breakpoint
CREATE TYPE "public"."commission_type" AS ENUM('percentage', 'flat_per_job');--> statement-breakpoint
CREATE TYPE "public"."provider_status" AS ENUM('active', 'inactive', 'pending', 'resubmission_requested', 'applied', 'onboarding', 'pending_review', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'dispatched', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'cashapp', 'zelle', 'stripe');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'confirmed', 'failed', 'refunded', 'partially_refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."payout_method" AS ENUM('manual_batch', 'stripe_connect');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'paid', 'clawback', 'held');--> statement-breakpoint
CREATE TYPE "public"."dispatch_algorithm" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."invite_type" AS ENUM('admin', 'beta', 'referral');--> statement-breakpoint
CREATE TYPE "public"."provider_invite_status" AS ENUM('pending', 'accepted', 'expired');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'issued', 'paid', 'overdue', 'cancelled', 'void');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('pending', 'credited', 'expired');--> statement-breakpoint
CREATE TYPE "public"."b2b_account_status" AS ENUM('pending', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."b2b_payment_terms" AS ENUM('prepaid', 'net_30', 'net_60');--> statement-breakpoint
CREATE TYPE "public"."step_status" AS ENUM('pending', 'draft', 'in_progress', 'pending_review', 'complete', 'rejected', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."step_type" AS ENUM('ic_agreement', 'background_check', 'insurance', 'certifications', 'training', 'stripe_connect', 'identity_verification');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('insurance', 'certification', 'vehicle_doc');--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	"phone" text,
	"password" text,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"tenantId" text,
	"trustTier" integer DEFAULT 1 NOT NULL,
	"cleanTransactionCount" integer DEFAULT 0 NOT NULL,
	"referralCode" text,
	"taxId" text,
	"stripeCustomerId" text,
	"defaultPaymentMethodId" text,
	"trustTierUpdatedAt" timestamp,
	"trustTierReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_referralCode_unique" UNIQUE("referralCode")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"basePrice" integer NOT NULL,
	"pricePerMile" integer,
	"category" "service_category" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"checklistConfig" jsonb,
	"schedulingMode" "scheduling_mode" DEFAULT 'both' NOT NULL,
	"commissionRate" integer DEFAULT 2500 NOT NULL,
	"stripeProductId" text,
	"tenantId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"commissionRate" integer DEFAULT 7000 NOT NULL,
	"commissionType" "commission_type" DEFAULT 'percentage' NOT NULL,
	"flatFeeAmount" integer,
	"status" "provider_status" DEFAULT 'pending' NOT NULL,
	"latitude" real,
	"longitude" real,
	"address" text,
	"is_available" boolean DEFAULT true NOT NULL,
	"currentLocation" jsonb,
	"lastLocationUpdate" timestamp,
	"specialties" jsonb DEFAULT '[]'::jsonb,
	"serviceAreas" jsonb DEFAULT '[]'::jsonb,
	"average_rating" real,
	"review_count" integer DEFAULT 0 NOT NULL,
	"stripeConnectAccountId" text,
	"migrationBypassExpiresAt" timestamp,
	"activatedAt" timestamp,
	"suspendedAt" timestamp,
	"suspendedReason" text,
	"previousApplicationId" text,
	"tenantId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"serviceId" text NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"vehicleInfo" jsonb NOT NULL,
	"location" jsonb NOT NULL,
	"contactName" text NOT NULL,
	"contactPhone" text NOT NULL,
	"contactEmail" text NOT NULL,
	"scheduledAt" timestamp,
	"estimatedPrice" integer NOT NULL,
	"finalPrice" integer,
	"towingMiles" integer,
	"referralCreditApplied" integer,
	"priceOverrideCents" integer,
	"priceOverrideReason" text,
	"notes" text,
	"preferredPaymentMethod" text,
	"providerId" text,
	"tenantId" text,
	"offerExpiresAt" timestamp,
	"dispatchAttempt" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"amount" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"stripeSessionId" text,
	"stripePaymentIntentId" text,
	"confirmedAt" timestamp,
	"confirmedBy" text,
	"tenantId" text,
	"refundAmount" integer,
	"refundedAt" timestamp,
	"refundedBy" text,
	"refundReason" text,
	"stripeTransferId" text,
	"applicationFeeAmount" integer,
	"chargeType" text,
	"stripeConnectAccountId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"providerId" text NOT NULL,
	"bookingId" text NOT NULL,
	"amount" integer NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"paidAt" timestamp,
	"payoutMethod" "payout_method" DEFAULT 'manual_batch' NOT NULL,
	"metadata" jsonb,
	"payoutType" text DEFAULT 'standard' NOT NULL,
	"originalPayoutId" text,
	"paymentId" text,
	"notes" text,
	"stripeTransferId" text,
	"holdReason" text,
	"heldAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"assignedProviderId" text,
	"algorithm" "dispatch_algorithm" NOT NULL,
	"distanceMeters" integer,
	"candidateProviders" jsonb,
	"reason" text,
	"score" real,
	"attemptNumber" integer,
	"outcome" text,
	"scoringWeights" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "password_reset_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "provider_invite_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"providerId" text,
	"invitedBy" text,
	"inviteType" "invite_type" DEFAULT 'admin' NOT NULL,
	"name" text,
	"referringProviderId" text,
	"status" "provider_invite_status" DEFAULT 'pending' NOT NULL,
	"expires" timestamp NOT NULL,
	"acceptedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_invite_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"keys" jsonb NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "business_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"companyName" text NOT NULL,
	"companyAddress" text,
	"companyPhone" text,
	"companyEmail" text,
	"logoUrl" text,
	"bankName" text,
	"bankAccountName" text,
	"bankAccountNumber" text,
	"bankRoutingNumber" text,
	"bankSwiftCode" text,
	"defaultPaymentTerms" text,
	"defaultPaymentMethod" text,
	"defaultPaymentInstructions" text,
	"invoicePrefix" text DEFAULT 'INV' NOT NULL,
	"defaultTaxRate" integer DEFAULT 0 NOT NULL,
	"invoiceFooterNote" text,
	"tenantId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoiceNumber" text NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"createdById" text,
	"customerId" text,
	"customerName" text NOT NULL,
	"customerEmail" text,
	"customerPhone" text,
	"customerCompany" text,
	"customerAddress" text,
	"bookingId" text,
	"paymentId" text,
	"lineItems" jsonb,
	"providerId" text,
	"providerName" text,
	"issueDate" timestamp DEFAULT now() NOT NULL,
	"issuedAt" timestamp,
	"paidAt" timestamp,
	"dueDate" timestamp,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"taxRate" integer DEFAULT 0 NOT NULL,
	"taxAmount" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"paymentTerms" text,
	"paymentMethod" text,
	"paymentInstructions" text,
	"notes" text,
	"tenantId" text,
	"billingPeriodStart" text,
	"billingPeriodEnd" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoiceNumber_unique" UNIQUE("invoiceNumber")
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"invoiceId" text NOT NULL,
	"description" text NOT NULL,
	"details" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unitPrice" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"providerId" text NOT NULL,
	"items" jsonb NOT NULL,
	"followUpSent" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"referrerId" text NOT NULL,
	"refereeId" text,
	"bookingId" text,
	"creditAmount" integer NOT NULL,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"providerId" text NOT NULL,
	"findings" jsonb NOT NULL,
	"reportUrl" text,
	"emailedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_block_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"startHour" integer NOT NULL,
	"endHour" integer NOT NULL,
	"multiplier" integer NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "b2b_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"companyName" text NOT NULL,
	"contactName" text NOT NULL,
	"contactEmail" text NOT NULL,
	"contactPhone" text NOT NULL,
	"billingAddress" jsonb NOT NULL,
	"paymentTerms" "b2b_payment_terms" DEFAULT 'net_30' NOT NULL,
	"status" "b2b_account_status" DEFAULT 'active' NOT NULL,
	"contract" jsonb DEFAULT 'null'::jsonb,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"providerId" text NOT NULL,
	"stepType" "step_type" NOT NULL,
	"status" "step_status" DEFAULT 'pending' NOT NULL,
	"draftData" jsonb,
	"metadata" jsonb,
	"completedAt" timestamp,
	"reviewedBy" text,
	"reviewedAt" timestamp,
	"rejectionReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"providerId" text NOT NULL,
	"onboardingStepId" text NOT NULL,
	"documentType" "document_type" NOT NULL,
	"s3Key" text NOT NULL,
	"originalFileName" text NOT NULL,
	"fileSize" integer NOT NULL,
	"mimeType" text NOT NULL,
	"status" "document_status" DEFAULT 'pending_review' NOT NULL,
	"rejectionReason" text,
	"reviewedBy" text,
	"reviewedAt" timestamp,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_adjustments_log" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"adjustmentType" text NOT NULL,
	"multiplierBp" integer NOT NULL,
	"reason" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surge_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"zoneId" text,
	"thresholdBookingsPerHour" integer DEFAULT 10 NOT NULL,
	"multiplierStepBp" integer DEFAULT 500 NOT NULL,
	"maxMultiplierBp" integer DEFAULT 30000 NOT NULL,
	"cooldownMinutes" integer DEFAULT 30 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_zones" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"polygon" jsonb NOT NULL,
	"baseMultiplierBp" integer DEFAULT 10000 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" text PRIMARY KEY NOT NULL,
	"stripeCouponId" text NOT NULL,
	"stripePromotionCodeId" text,
	"code" text NOT NULL,
	"description" text,
	"discountType" text NOT NULL,
	"discountAmount" integer NOT NULL,
	"maxRedemptions" integer,
	"currentRedemptions" integer DEFAULT 0 NOT NULL,
	"expiresAt" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "service_bundles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"serviceIds" jsonb NOT NULL,
	"bundlePrice" integer NOT NULL,
	"savingsAmount" integer,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_bundles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"windowStart" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text NOT NULL,
	"source" text NOT NULL,
	"processedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_source_id_pk" PRIMARY KEY("source","id")
);
--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_serviceId_services_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmedBy_users_id_fk" FOREIGN KEY ("confirmedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refundedBy_users_id_fk" FOREIGN KEY ("refundedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_payouts" ADD CONSTRAINT "provider_payouts_providerId_providers_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_payouts" ADD CONSTRAINT "provider_payouts_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_logs" ADD CONSTRAINT "dispatch_logs_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_logs" ADD CONSTRAINT "dispatch_logs_assignedProviderId_providers_id_fk" FOREIGN KEY ("assignedProviderId") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_invite_tokens" ADD CONSTRAINT "provider_invite_tokens_providerId_providers_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_invite_tokens" ADD CONSTRAINT "provider_invite_tokens_invitedBy_users_id_fk" FOREIGN KEY ("invitedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_invite_tokens" ADD CONSTRAINT "provider_invite_tokens_referringProviderId_providers_id_fk" FOREIGN KEY ("referringProviderId") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_users_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_users_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_paymentId_payments_id_fk" FOREIGN KEY ("paymentId") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoiceId_invoices_id_fk" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_users_id_fk" FOREIGN KEY ("referrerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_refereeId_users_id_fk" FOREIGN KEY ("refereeId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_steps" ADD CONSTRAINT "onboarding_steps_providerId_providers_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_documents" ADD CONSTRAINT "provider_documents_providerId_providers_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_documents" ADD CONSTRAINT "provider_documents_onboardingStepId_onboarding_steps_id_fk" FOREIGN KEY ("onboardingStepId") REFERENCES "public"."onboarding_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_payments_stripe_session" ON "payments" USING btree ("stripeSessionId") WHERE "payments"."stripeSessionId" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_payout_standard_booking" ON "provider_payouts" USING btree ("bookingId") WHERE "provider_payouts"."payoutType" = 'standard';--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_payout_clawback_original" ON "provider_payouts" USING btree ("originalPayoutId") WHERE "provider_payouts"."payoutType" = 'clawback' AND "provider_payouts"."originalPayoutId" IS NOT NULL;
CREATE TYPE "public"."dispatch_algorithm" AS ENUM('auto', 'manual');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'provider';--> statement-breakpoint
CREATE TABLE "dispatch_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"assignedProviderId" text,
	"algorithm" "dispatch_algorithm" NOT NULL,
	"distanceMeters" integer,
	"candidateProviders" jsonb,
	"reason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "password_reset_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
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
ALTER TABLE "providers" ADD COLUMN "latitude" real;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "longitude" real;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "is_available" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "currentLocation" jsonb;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "lastLocationUpdate" timestamp;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "average_rating" real;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "review_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "dispatch_logs" ADD CONSTRAINT "dispatch_logs_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_logs" ADD CONSTRAINT "dispatch_logs_assignedProviderId_providers_id_fk" FOREIGN KEY ("assignedProviderId") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
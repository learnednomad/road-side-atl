CREATE TYPE "public"."membership_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TABLE "membership_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"priceCents" integer NOT NULL,
	"interval" "membership_interval" DEFAULT 'month' NOT NULL,
	"discountBp" integer DEFAULT 0 NOT NULL,
	"priorityDispatch" boolean DEFAULT false NOT NULL,
	"stripePriceId" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "membership_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"planId" text NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"stripeSubscriptionId" text,
	"currentPeriodEnd" timestamp,
	"discountBp" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_stripeSubscriptionId_unique" UNIQUE("stripeSubscriptionId")
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE TYPE "public"."commission_scope" AS ENUM('global', 'service', 'provider', 'account');--> statement-breakpoint
CREATE TABLE "commission_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" "commission_scope" NOT NULL,
	"scopeId" text,
	"commissionRateBp" integer NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

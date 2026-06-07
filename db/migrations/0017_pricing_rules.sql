CREATE TYPE "public"."pricing_rule_scope" AS ENUM('global', 'service');--> statement-breakpoint
CREATE TABLE "pricing_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" "pricing_rule_scope" NOT NULL,
	"scopeId" text,
	"multiplierBp" integer NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

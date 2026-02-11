CREATE TYPE "public"."provider_invite_status" AS ENUM('pending', 'accepted', 'expired');--> statement-breakpoint
CREATE TABLE "provider_invite_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"providerId" text NOT NULL,
	"invitedBy" text,
	"status" "provider_invite_status" DEFAULT 'pending' NOT NULL,
	"expires" timestamp NOT NULL,
	"acceptedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_invite_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "provider_invite_tokens" ADD CONSTRAINT "provider_invite_tokens_providerId_providers_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_invite_tokens" ADD CONSTRAINT "provider_invite_tokens_invitedBy_users_id_fk" FOREIGN KEY ("invitedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
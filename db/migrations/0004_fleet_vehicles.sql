CREATE TABLE "fleet_vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"label" text,
	"year" integer,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"color" text,
	"vin" text,
	"licensePlate" text,
	"notes" text,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "fleetVehicleId" text;--> statement-breakpoint
ALTER TABLE "fleet_vehicles" ADD CONSTRAINT "fleet_vehicles_accountId_b2b_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."b2b_accounts"("id") ON DELETE cascade ON UPDATE no action;
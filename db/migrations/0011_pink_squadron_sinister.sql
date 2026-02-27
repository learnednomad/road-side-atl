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

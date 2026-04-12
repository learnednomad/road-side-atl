-- Phase 4: Service bundles

CREATE TABLE IF NOT EXISTS "service_bundles" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "description" text,
  "serviceIds" jsonb NOT NULL,
  "bundlePrice" integer NOT NULL,
  "savingsAmount" integer,
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "services" ADD COLUMN "estimateMinCents" integer;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "estimateMaxCents" integer;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "estimateNote" text;--> statement-breakpoint
-- Backfill estimate ranges for pre-existing service rows (Atlanta 2026 benchmarks).
UPDATE "services" SET "estimateMinCents" = 3000,  "estimateMaxCents" = 14000  WHERE slug = 'oil-change';--> statement-breakpoint
UPDATE "services" SET "estimateMinCents" = 7500,  "estimateMaxCents" = 15000  WHERE slug = 'mobile-diagnostic';--> statement-breakpoint
UPDATE "services" SET "estimateMinCents" = 15000, "estimateMaxCents" = 40000, "estimateNote" = 'Rotor replacement quoted separately if needed' WHERE slug = 'brake-service';--> statement-breakpoint
UPDATE "services" SET "estimateMinCents" = 30000, "estimateMaxCents" = 60000  WHERE slug = 'brake-service-rotors';--> statement-breakpoint
UPDATE "services" SET "estimateMinCents" = 18000, "estimateMaxCents" = 35000, "estimateNote" = 'AGM and trunk-mounted batteries priced higher' WHERE slug = 'battery-replace';--> statement-breakpoint
UPDATE "services" SET "estimateMinCents" = 45000, "estimateMaxCents" = 90000  WHERE slug = 'alternator-replace';--> statement-breakpoint
UPDATE "services" SET "estimateMinCents" = 35000, "estimateMaxCents" = 80000  WHERE slug = 'starter-replace';--> statement-breakpoint
UPDATE "services" SET "estimateMinCents" = 15000, "estimateMaxCents" = 35000, "estimateNote" = 'Component repair quoted separately if leak detected' WHERE slug = 'ac-recharge';--> statement-breakpoint
UPDATE "services" SET "estimateMinCents" = 30000, "estimateMaxCents" = 60000  WHERE slug = 'ac-repair';--> statement-breakpoint
UPDATE "services" SET "estimateMinCents" = 10000, "estimateMaxCents" = 18000, "estimateNote" = 'ADAS calibration quoted separately if vehicle requires it' WHERE slug = 'wheel-alignment';--> statement-breakpoint
UPDATE "services" SET "estimateMinCents" = 30000, "estimateMaxCents" = 90000, "estimateNote" = 'Per component set; alignment recommended after' WHERE slug = 'suspension-repair';--> statement-breakpoint
UPDATE "services" SET "estimateMinCents" = 20000, "estimateMaxCents" = 60000, "estimateNote" = 'Turbo engines and intake-access jobs priced higher' WHERE slug = 'tune-up';--> statement-breakpoint
UPDATE "services" SET "estimateMinCents" = 25000, "estimateMaxCents" = 60000, "estimateNote" = 'Internal transmission repairs quoted separately' WHERE slug = 'transmission-service';--> statement-breakpoint
UPDATE "services" SET "estimateMinCents" = 7500,  "estimateMaxCents" = 18000, "estimateNote" = 'Per-mile beyond 10 mi; flatbed and after-hours surcharge extra' WHERE slug = 'towing';

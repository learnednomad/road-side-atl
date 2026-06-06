-- Add transparent estimate-range columns to services table.
-- Surfaced on /book as "Base $X, typical range $X-$Y, final quoted on-site".

ALTER TABLE "services" ADD COLUMN "estimateMinCents" integer;
ALTER TABLE "services" ADD COLUMN "estimateMaxCents" integer;
ALTER TABLE "services" ADD COLUMN "estimateNote" text;

-- Backfill ranges from Atlanta 2026 research benchmarks (independent-shop bands).
-- Source: docs/atlanta_vehicle_service_cost_deep_dive (1).md

UPDATE "services" SET "estimateMinCents" = 3000,  "estimateMaxCents" = 14000  WHERE slug = 'oil-change';
UPDATE "services" SET "estimateMinCents" = 7500,  "estimateMaxCents" = 15000  WHERE slug = 'mobile-diagnostic';
UPDATE "services" SET "estimateMinCents" = 15000, "estimateMaxCents" = 40000, "estimateNote" = 'Rotor replacement quoted separately if needed' WHERE slug = 'brake-service';
UPDATE "services" SET "estimateMinCents" = 30000, "estimateMaxCents" = 60000  WHERE slug = 'brake-service-rotors';
UPDATE "services" SET "estimateMinCents" = 18000, "estimateMaxCents" = 35000, "estimateNote" = 'AGM and trunk-mounted batteries priced higher' WHERE slug = 'battery-replace';
UPDATE "services" SET "estimateMinCents" = 45000, "estimateMaxCents" = 90000  WHERE slug = 'alternator-replace';
UPDATE "services" SET "estimateMinCents" = 35000, "estimateMaxCents" = 80000  WHERE slug = 'starter-replace';
UPDATE "services" SET "estimateMinCents" = 15000, "estimateMaxCents" = 35000, "estimateNote" = 'Component repair quoted separately if leak detected' WHERE slug = 'ac-recharge';
UPDATE "services" SET "estimateMinCents" = 30000, "estimateMaxCents" = 60000  WHERE slug = 'ac-repair';
UPDATE "services" SET "estimateMinCents" = 10000, "estimateMaxCents" = 18000, "estimateNote" = 'ADAS calibration quoted separately if vehicle requires it' WHERE slug = 'wheel-alignment';
UPDATE "services" SET "estimateMinCents" = 30000, "estimateMaxCents" = 90000, "estimateNote" = 'Per component set; alignment recommended after' WHERE slug = 'suspension-repair';
UPDATE "services" SET "estimateMinCents" = 20000, "estimateMaxCents" = 60000, "estimateNote" = 'Turbo engines and intake-access jobs priced higher' WHERE slug = 'tune-up';
UPDATE "services" SET "estimateMinCents" = 25000, "estimateMaxCents" = 60000, "estimateNote" = 'Internal transmission repairs quoted separately' WHERE slug = 'transmission-service';

-- Towing: base + per-mile is already on the row; estimate covers a 10-mi tow
UPDATE "services" SET "estimateMinCents" = 7500,  "estimateMaxCents" = 18000, "estimateNote" = 'Per-mile beyond 10 mi; flatbed and after-hours surcharge extra' WHERE slug = 'towing';

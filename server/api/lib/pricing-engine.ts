import { db } from "@/db";
import { timeBlockConfigs, services, bookings, surgeConfigs, providers, pricingRules, pricingZones } from "@/db/schema";
import { eq, sql, gte, and, inArray, isNull } from "drizzle-orm";
import { DEFAULT_MULTIPLIER_BP } from "@/lib/constants";
import { isFeatureEnabled, FEATURE_FLAGS } from "./feature-flags";
import { getWeatherMultiplier } from "./weather-pricing";

export interface PricingBreakdown {
  label: string;
  type: string;
  multiplierBp: number;
  amount: number; // cents contribution
}

export interface PricingResult {
  basePrice: number; // cents
  multiplier: number; // effective combined multiplier in basis points
  blockName: string;
  surgeMultiplierBp: number; // surge component in basis points (10000 = 1.0x)
  finalPrice: number; // cents
  breakdown: PricingBreakdown[];
  surgeActive: boolean;
}

/**
 * Composable pricing pipeline:
 * 1. Base price (from service)
 * 2. Time-block multiplier (existing)
 * 3. Demand surge multiplier (new, feature-flagged)
 *
 * All multipliers compose multiplicatively in basis points.
 * Final price = basePrice * (timeBlockBP / 10000) * (surgeBP / 10000)
 *
 * Guardrails: final price capped at 3x base price (configurable).
 */
/**
 * Resolve the configurable pricing-matrix multiplier (basis points): the
 * highest-priority active rule, service-scope over global. 10000 (1.0x) when
 * nothing matches. Only consulted when PRICING_MATRIX is on.
 */
async function resolvePricingMatrixBp(serviceId: string): Promise<number> {
  const rows = await db
    .select()
    .from(pricingRules)
    .where(and(eq(pricingRules.active, true), inArray(pricingRules.scope, ["service", "global"])));
  const candidates = rows.filter((r) => r.scope === "global" || r.scopeId === serviceId);
  if (candidates.length === 0) return 10000;
  let best = candidates[0];
  for (const r of candidates) {
    const better =
      (r.scope === "service" && best.scope !== "service") ||
      (r.scope === best.scope && r.priority > best.priority);
    if (better) best = r;
  }
  return best.multiplierBp;
}

/**
 * Ray-casting point-in-polygon test. `polygon` is an ordered ring of
 * {lat, lng} vertices (lng = x, lat = y); the ring is treated as closed.
 * Returns true if (lat, lng) is inside. No external dependency.
 */
export function pointInPolygon(
  lat: number,
  lng: number,
  polygon: Array<{ lat: number; lng: number }>,
): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Resolve the geographic zone multiplier (basis points) for a location: the
 * first active zone whose polygon contains the point. 10000 (1.0x) when the
 * point is outside every zone. Only consulted when ZONE_PRICING is on and a
 * location is supplied.
 */
async function resolveZoneMultiplier(
  lat: number,
  lng: number,
): Promise<{ multiplierBp: number; zoneName: string } | null> {
  const zones = await db.query.pricingZones.findMany({
    where: eq(pricingZones.active, true),
  });
  for (const zone of zones) {
    if (pointInPolygon(lat, lng, zone.polygon)) {
      return { multiplierBp: zone.baseMultiplierBp, zoneName: zone.name };
    }
  }
  return null;
}

export async function calculateBookingPrice(
  serviceId: string,
  scheduledAt?: Date | null,
  ctx?: { location?: { latitude?: number; longitude?: number }; accountId?: string },
): Promise<PricingResult> {
  const service = await db.query.services.findFirst({
    where: eq(services.id, serviceId),
  });
  if (!service) throw new Error("Service not found");

  // Location context (lat/lng) unlocks the zone + weather steps below. Only
  // present when the caller supplies coordinates; absent for most estimates.
  const lat = ctx?.location?.latitude;
  const lng = ctx?.location?.longitude;
  const hasLocation = typeof lat === "number" && typeof lng === "number";

  const pricingDate = scheduledAt ?? new Date();
  const hour = pricingDate.getHours();
  const breakdown: PricingBreakdown[] = [];

  // ── Step 1: Time-block multiplier ─────────────────────────────

  const configs = await db.query.timeBlockConfigs.findMany({
    where: eq(timeBlockConfigs.isActive, true),
  });

  const matching = configs
    .filter((c) => {
      if (c.startHour <= c.endHour) {
        return hour >= c.startHour && hour < c.endHour;
      }
      return hour >= c.startHour || hour < c.endHour;
    })
    .sort((a, b) => b.priority - a.priority);

  const block = matching[0];
  const timeBlockMultiplierBp = block?.multiplier ?? DEFAULT_MULTIPLIER_BP;
  const blockName = block?.name ?? "Standard";

  const afterTimeBlock = Math.round((service.basePrice * timeBlockMultiplierBp) / 10000);
  breakdown.push({
    label: blockName === "Standard" ? "Base rate" : `${blockName} (${(timeBlockMultiplierBp / 100).toFixed(0)}%)`,
    type: "time_block",
    multiplierBp: timeBlockMultiplierBp,
    amount: afterTimeBlock,
  });

  // ── Step 2: Demand surge multiplier ───────────────────────────

  let surgeMultiplierBp = 10000; // 1.0x (no surge)
  let surgeActive = false;

  const surgeEnabled = await isFeatureEnabled(FEATURE_FLAGS.SURGE_PRICING);
  if (surgeEnabled) {
    surgeMultiplierBp = await calculateSurgeMultiplier();
    if (surgeMultiplierBp > 10000) {
      surgeActive = true;
      const surgeAmount = Math.round((afterTimeBlock * surgeMultiplierBp) / 10000) - afterTimeBlock;
      breakdown.push({
        label: `High demand (${(surgeMultiplierBp / 100).toFixed(0)}%)`,
        type: "surge",
        multiplierBp: surgeMultiplierBp,
        amount: surgeAmount,
      });
    }
  }

  // ── Step 3: Provider scarcity multiplier ────────────────────────

  let scarcityMultiplierBp = 10000;
  const availableCount = await getAvailableProviderCount();
  const SCARCITY_THRESHOLD = 3; // below this count, scarcity kicks in
  const SCARCITY_STEP_BP = 500; // 5% per missing provider
  const MAX_SCARCITY_BP = 15000; // max 1.5x

  if (availableCount < SCARCITY_THRESHOLD && availableCount >= 0) {
    const deficit = SCARCITY_THRESHOLD - availableCount;
    scarcityMultiplierBp = Math.min(MAX_SCARCITY_BP, 10000 + deficit * SCARCITY_STEP_BP);

    if (scarcityMultiplierBp > 10000) {
      const preScarce = Math.round((afterTimeBlock * surgeMultiplierBp) / 10000);
      const scarceAmount = Math.round((preScarce * scarcityMultiplierBp) / 10000) - preScarce;
      breakdown.push({
        label: `Limited availability (${availableCount} providers)`,
        type: "scarcity",
        multiplierBp: scarcityMultiplierBp,
        amount: scarceAmount,
      });
    }
  }

  // ── Step 4: Configurable pricing-matrix multiplier (flag-gated) ──

  let matrixMultiplierBp = 10000;
  const matrixEnabled = await isFeatureEnabled(FEATURE_FLAGS.PRICING_MATRIX);
  if (matrixEnabled) {
    matrixMultiplierBp = await resolvePricingMatrixBp(serviceId);
    if (matrixMultiplierBp !== 10000) {
      const preMatrix = Math.round((afterTimeBlock * surgeMultiplierBp * scarcityMultiplierBp) / (10000 * 10000));
      const matrixAmount = Math.round((preMatrix * matrixMultiplierBp) / 10000) - preMatrix;
      breakdown.push({
        label: `Pricing rule (${(matrixMultiplierBp / 100).toFixed(0)}%)`,
        type: "matrix",
        multiplierBp: matrixMultiplierBp,
        amount: matrixAmount,
      });
    }
  }

  // ── Step 5: Geographic zone multiplier (flag-gated, needs location) ──

  let zoneMultiplierBp = 10000;
  if (hasLocation && (await isFeatureEnabled(FEATURE_FLAGS.ZONE_PRICING))) {
    const zone = await resolveZoneMultiplier(lat!, lng!);
    if (zone && zone.multiplierBp !== 10000) {
      zoneMultiplierBp = zone.multiplierBp;
      const preZone = Math.round(
        (afterTimeBlock * surgeMultiplierBp * scarcityMultiplierBp * matrixMultiplierBp) /
          (10000 * 10000 * 10000),
      );
      const zoneAmount = Math.round((preZone * zoneMultiplierBp) / 10000) - preZone;
      breakdown.push({
        label: `${zone.zoneName} zone (${(zoneMultiplierBp / 100).toFixed(0)}%)`,
        type: "zone",
        multiplierBp: zoneMultiplierBp,
        amount: zoneAmount,
      });
    }
  }

  // ── Step 6: Weather multiplier (flag-gated, needs location) ─────

  let weatherMultiplierBp = 10000;
  if (hasLocation && (await isFeatureEnabled(FEATURE_FLAGS.WEATHER_PRICING))) {
    const weather = await getWeatherMultiplier(lat!, lng!);
    if (weather.multiplierBp !== 10000) {
      weatherMultiplierBp = weather.multiplierBp;
      const preWeather = Math.round(
        (afterTimeBlock * surgeMultiplierBp * scarcityMultiplierBp * matrixMultiplierBp * zoneMultiplierBp) /
          (10000 * 10000 * 10000 * 10000),
      );
      const weatherAmount = Math.round((preWeather * weatherMultiplierBp) / 10000) - preWeather;
      breakdown.push({
        label: `Weather: ${weather.condition} (${(weatherMultiplierBp / 100).toFixed(0)}%)`,
        type: "weather",
        multiplierBp: weatherMultiplierBp,
        amount: weatherAmount,
      });
    }
  }

  // ── Calculate final price ─────────────────────────────────────

  let finalPrice = Math.round(
    (afterTimeBlock * surgeMultiplierBp * scarcityMultiplierBp * matrixMultiplierBp * zoneMultiplierBp * weatherMultiplierBp) /
      (10000 * 10000 * 10000 * 10000 * 10000),
  );

  // Guardrail: cap at 3x base price
  const MAX_PRICE_MULTIPLIER = 3;
  const priceCeiling = service.basePrice * MAX_PRICE_MULTIPLIER;
  if (finalPrice > priceCeiling) {
    finalPrice = priceCeiling;
  }

  // Effective combined multiplier for backward compatibility
  const effectiveMultiplier = service.basePrice > 0
    ? Math.round((finalPrice / service.basePrice) * 10000)
    : timeBlockMultiplierBp;

  return {
    basePrice: service.basePrice,
    multiplier: effectiveMultiplier,
    blockName,
    surgeMultiplierBp,
    finalPrice,
    breakdown,
    surgeActive,
  };
}

/**
 * Calculate demand surge multiplier based on recent booking volume.
 *
 * Algorithm:
 * - Count bookings created in the last 60 minutes
 * - If count exceeds threshold, apply stepped multiplier
 * - surgeMultiplier = 10000 + (count - threshold) * stepBp
 * - Capped at maxMultiplierBp
 *
 * Returns multiplier in basis points (10000 = 1.0x, 15000 = 1.5x).
 */
async function calculateSurgeMultiplier(): Promise<number> {
  // Get the global surge config (zoneId IS NULL). Filtering on zoneId matters:
  // a zone-scoped config must not be picked up and applied platform-wide.
  const config = await db.query.surgeConfigs.findFirst({
    where: and(eq(surgeConfigs.active, true), isNull(surgeConfigs.zoneId)),
  });

  if (!config) return 10000; // No config = no surge

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [result] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(bookings)
    .where(gte(bookings.createdAt, oneHourAgo));

  const recentCount = Number(result?.count ?? 0);

  if (recentCount <= config.thresholdBookingsPerHour) {
    return 10000; // Below threshold — no surge
  }

  const excess = recentCount - config.thresholdBookingsPerHour;
  const surgeMultiplier = 10000 + excess * config.multiplierStepBp;

  return Math.min(surgeMultiplier, config.maxMultiplierBp);
}

/**
 * Count currently available providers (isAvailable=true, status=active).
 */
async function getAvailableProviderCount(): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(providers)
    .where(
      and(
        eq(providers.isAvailable, true),
        eq(providers.status, "active"),
      ),
    );
  return Number(result?.count ?? 0);
}

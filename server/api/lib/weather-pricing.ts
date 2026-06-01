/**
 * Weather-based pricing multiplier.
 *
 * Integrates with OpenWeatherMap API to adjust prices based on current
 * weather conditions at the booking location.
 *
 * Multipliers (basis points, 10000 = 1.0x):
 * - Clear/Clouds: 10000 (no adjustment)
 * - Drizzle/Rain: 11000 (1.1x)
 * - Thunderstorm: 12500 (1.25x)
 * - Snow/Ice: 15000 (1.5x)
 *
 * Cache: 15-minute TTL per rounded lat/lng (2 decimal places).
 * Falls back to 10000 (1.0x) on API failure.
 */

import { logger } from "@/lib/logger";

const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const WEATHER_MULTIPLIERS: Record<string, number> = {
  Clear: 10000,
  Clouds: 10000,
  Mist: 10000,
  Haze: 10000,
  Fog: 10500,
  Drizzle: 11000,
  Rain: 11000,
  Squall: 12000,
  Thunderstorm: 12500,
  Snow: 15000,
  Tornado: 15000,
};

interface CacheEntry {
  multiplierBp: number;
  condition: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

/**
 * Get weather-based pricing multiplier for a location.
 * Returns basis points (10000 = 1.0x, no adjustment).
 */
export async function getWeatherMultiplier(lat: number, lng: number): Promise<{
  multiplierBp: number;
  condition: string;
}> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    return { multiplierBp: 10000, condition: "unknown" };
  }

  const key = getCacheKey(lat, lng);
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return { multiplierBp: cached.multiplierBp, condition: cached.condition };
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat.toFixed(2)}&lon=${lng.toFixed(2)}&appid=${apiKey}&units=imperial`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!resp.ok) {
      logger.warn("[WeatherPricing] API error", { status: resp.status });
      return { multiplierBp: 10000, condition: "api_error" };
    }

    const data = await resp.json() as { weather?: Array<{ main: string }> };
    const condition = data.weather?.[0]?.main ?? "Clear";
    const multiplierBp = WEATHER_MULTIPLIERS[condition] ?? 10000;

    // Cache the result
    cache.set(key, {
      multiplierBp,
      condition,
      expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
    });

    // Evict old entries
    if (cache.size > 500) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }

    return { multiplierBp, condition };
  } catch (err) {
    logger.warn("[WeatherPricing] API call failed, using default", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { multiplierBp: 10000, condition: "fetch_error" };
  }
}

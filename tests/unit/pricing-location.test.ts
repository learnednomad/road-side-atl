import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────

const mockZones = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      services: { findFirst: vi.fn().mockResolvedValue({ id: "svc-1", basePrice: 10000 }) },
      timeBlockConfigs: { findMany: vi.fn().mockResolvedValue([]) },
      surgeConfigs: { findFirst: vi.fn().mockResolvedValue(null) },
      pricingZones: { findMany: (...args: unknown[]) => mockZones(...args) },
    },
    // getAvailableProviderCount() → 5 (≥ threshold) so scarcity stays 1.0x.
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ count: 5 }]) })),
    })),
  },
}));

const mockFlags: Record<string, boolean> = {};
vi.mock("@/server/api/lib/feature-flags", async (importActual) => {
  const actual = await importActual<typeof import("@/server/api/lib/feature-flags")>();
  return {
    ...actual,
    isFeatureEnabled: vi.fn(async (flag: string) => mockFlags[flag] ?? false),
  };
});

const mockWeather = vi.fn();
vi.mock("@/server/api/lib/weather-pricing", () => ({
  getWeatherMultiplier: (...args: unknown[]) => mockWeather(...args),
}));

import { calculateBookingPrice, pointInPolygon } from "@/server/api/lib/pricing-engine";
import { FEATURE_FLAGS } from "@/server/api/lib/feature-flags";

// A unit square covering (0..10, 0..10) in lat/lng.
const SQUARE = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 10 },
  { lat: 10, lng: 10 },
  { lat: 10, lng: 0 },
];

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(mockFlags)) delete mockFlags[k];
  mockZones.mockResolvedValue([]);
  mockWeather.mockResolvedValue({ multiplierBp: 10000, condition: "Clear" });
});

describe("pointInPolygon", () => {
  it("returns true for a point inside the polygon", () => {
    expect(pointInPolygon(5, 5, SQUARE)).toBe(true);
  });
  it("returns false for a point outside the polygon", () => {
    expect(pointInPolygon(15, 15, SQUARE)).toBe(false);
    expect(pointInPolygon(5, -1, SQUARE)).toBe(false);
  });
  it("returns false for a degenerate polygon (<3 points)", () => {
    expect(pointInPolygon(5, 5, [{ lat: 0, lng: 0 }, { lat: 10, lng: 10 }])).toBe(false);
  });
});

describe("calculateBookingPrice — zone pricing", () => {
  it("applies the zone multiplier when ZONE_PRICING is on and the point is inside a zone", async () => {
    mockFlags[FEATURE_FLAGS.ZONE_PRICING] = true;
    mockZones.mockResolvedValue([{ name: "Downtown", baseMultiplierBp: 12000, polygon: SQUARE }]);

    const result = await calculateBookingPrice("svc-1", new Date("2026-02-22T12:00:00"), {
      location: { latitude: 5, longitude: 5 },
    });

    // 10000 base * 1.2 zone = 12000
    expect(result.finalPrice).toBe(12000);
    expect(result.breakdown.some((b) => b.type === "zone")).toBe(true);
  });

  it("does NOT apply zone pricing when the flag is off (default)", async () => {
    mockZones.mockResolvedValue([{ name: "Downtown", baseMultiplierBp: 12000, polygon: SQUARE }]);

    const result = await calculateBookingPrice("svc-1", new Date("2026-02-22T12:00:00"), {
      location: { latitude: 5, longitude: 5 },
    });

    expect(result.finalPrice).toBe(10000); // unchanged
    expect(result.breakdown.some((b) => b.type === "zone")).toBe(false);
  });

  it("does NOT apply zone pricing when the point is outside every zone", async () => {
    mockFlags[FEATURE_FLAGS.ZONE_PRICING] = true;
    mockZones.mockResolvedValue([{ name: "Downtown", baseMultiplierBp: 12000, polygon: SQUARE }]);

    const result = await calculateBookingPrice("svc-1", new Date("2026-02-22T12:00:00"), {
      location: { latitude: 50, longitude: 50 },
    });

    expect(result.finalPrice).toBe(10000);
    expect(result.breakdown.some((b) => b.type === "zone")).toBe(false);
  });

  it("does NOT query zones when no location is supplied", async () => {
    mockFlags[FEATURE_FLAGS.ZONE_PRICING] = true;

    const result = await calculateBookingPrice("svc-1", new Date("2026-02-22T12:00:00"));

    expect(result.finalPrice).toBe(10000);
    expect(mockZones).not.toHaveBeenCalled();
  });
});

describe("calculateBookingPrice — weather pricing", () => {
  it("applies the weather multiplier when WEATHER_PRICING is on", async () => {
    mockFlags[FEATURE_FLAGS.WEATHER_PRICING] = true;
    mockWeather.mockResolvedValue({ multiplierBp: 12500, condition: "Thunderstorm" });

    const result = await calculateBookingPrice("svc-1", new Date("2026-02-22T12:00:00"), {
      location: { latitude: 5, longitude: 5 },
    });

    // 10000 base * 1.25 weather = 12500
    expect(result.finalPrice).toBe(12500);
    expect(result.breakdown.some((b) => b.type === "weather")).toBe(true);
  });

  it("does NOT call the weather API when the flag is off", async () => {
    const result = await calculateBookingPrice("svc-1", new Date("2026-02-22T12:00:00"), {
      location: { latitude: 5, longitude: 5 },
    });

    expect(result.finalPrice).toBe(10000);
    expect(mockWeather).not.toHaveBeenCalled();
  });

  it("composes zone and weather multiplicatively", async () => {
    mockFlags[FEATURE_FLAGS.ZONE_PRICING] = true;
    mockFlags[FEATURE_FLAGS.WEATHER_PRICING] = true;
    mockZones.mockResolvedValue([{ name: "Downtown", baseMultiplierBp: 12000, polygon: SQUARE }]);
    mockWeather.mockResolvedValue({ multiplierBp: 11000, condition: "Rain" });

    const result = await calculateBookingPrice("svc-1", new Date("2026-02-22T12:00:00"), {
      location: { latitude: 5, longitude: 5 },
    });

    // 10000 * 1.2 * 1.1 = 13200
    expect(result.finalPrice).toBe(13200);
  });
});

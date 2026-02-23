import { describe, it, expect } from "vitest";
import { calculateDistance, milesToMeters } from "@/lib/distance";

describe("calculateDistance (Haversine)", () => {
  it("returns 0 for identical points", () => {
    const point = { latitude: 33.749, longitude: -84.388 };
    expect(calculateDistance(point, point)).toBe(0);
  });

  it("calculates Atlanta downtown to Hartsfield-Jackson (~9 miles)", () => {
    const downtown = { latitude: 33.749, longitude: -84.388 };
    const airport = { latitude: 33.6407, longitude: -84.4277 };
    const distance = calculateDistance(downtown, airport);
    // Known distance is approximately 7.8–8.5 miles
    expect(distance).toBeGreaterThan(7);
    expect(distance).toBeLessThan(10);
  });

  it("calculates Atlanta to Savannah (~248 miles)", () => {
    const atlanta = { latitude: 33.749, longitude: -84.388 };
    const savannah = { latitude: 32.0809, longitude: -81.0912 };
    const distance = calculateDistance(atlanta, savannah);
    expect(distance).toBeGreaterThan(220);
    expect(distance).toBeLessThan(270);
  });

  it("is symmetric (A→B === B→A)", () => {
    const a = { latitude: 33.749, longitude: -84.388 };
    const b = { latitude: 34.0522, longitude: -84.2218 };
    expect(calculateDistance(a, b)).toBeCloseTo(calculateDistance(b, a), 10);
  });

  it("handles equator crossing", () => {
    const north = { latitude: 1, longitude: 0 };
    const south = { latitude: -1, longitude: 0 };
    const distance = calculateDistance(north, south);
    // 2 degrees latitude ≈ 138 miles
    expect(distance).toBeGreaterThan(130);
    expect(distance).toBeLessThan(145);
  });

  it("handles antimeridian crossing", () => {
    const west = { latitude: 0, longitude: 179 };
    const east = { latitude: 0, longitude: -179 };
    const distance = calculateDistance(west, east);
    // 2 degrees longitude at equator ≈ 138 miles
    expect(distance).toBeGreaterThan(130);
    expect(distance).toBeLessThan(145);
  });
});

describe("milesToMeters", () => {
  it("converts 0 miles to 0 meters", () => {
    expect(milesToMeters(0)).toBe(0);
  });

  it("converts 1 mile to ~1609 meters", () => {
    expect(milesToMeters(1)).toBe(1609);
  });

  it("converts 10 miles to ~16093 meters", () => {
    expect(milesToMeters(10)).toBe(16093);
  });

  it("rounds to nearest integer", () => {
    const result = milesToMeters(0.5);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(805);
  });
});

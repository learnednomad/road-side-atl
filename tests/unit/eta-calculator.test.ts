import { describe, it, expect } from "vitest";
import { calculateEtaMinutes } from "@/server/api/lib/eta-calculator";

describe("calculateEtaMinutes", () => {
  it("returns minimum 1 minute for very close points", () => {
    // Same location
    const eta = calculateEtaMinutes(33.749, -84.388, 33.749, -84.388);
    expect(eta).toBe(1);
  });

  it("calculates ETA for downtown ATL to airport (~8 mi at 35mph ≈ 14 min)", () => {
    const eta = calculateEtaMinutes(33.749, -84.388, 33.6407, -84.4277);
    // ~8 miles / 35 mph = ~13.7 minutes
    expect(eta).toBeGreaterThanOrEqual(10);
    expect(eta).toBeLessThanOrEqual(20);
  });

  it("calculates ETA for longer distance (50 miles ≈ 86 min)", () => {
    // Atlanta to Gainesville GA (~50 miles)
    const eta = calculateEtaMinutes(33.749, -84.388, 34.2979, -83.8241);
    // ~50 miles / 35 mph ≈ 86 minutes
    expect(eta).toBeGreaterThanOrEqual(70);
    expect(eta).toBeLessThanOrEqual(110);
  });

  it("returns an integer", () => {
    const eta = calculateEtaMinutes(33.749, -84.388, 33.8, -84.4);
    expect(Number.isInteger(eta)).toBe(true);
  });

  it("never returns less than 1", () => {
    // Very tiny distance
    const eta = calculateEtaMinutes(33.749, -84.388, 33.7491, -84.3881);
    expect(eta).toBeGreaterThanOrEqual(1);
  });
});

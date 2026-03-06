import { describe, it, expect } from "vitest";
import { TIER_1_ALLOWED_METHODS, TIER_2_ALLOWED_METHODS } from "@/lib/constants";

// Import the pure function directly — DB-dependent functions tested separately
import { getAllowedPaymentMethods } from "@/server/api/lib/trust-tier";

describe("getAllowedPaymentMethods", () => {
  it("returns Tier 1 methods for tier 1 users", () => {
    const methods = getAllowedPaymentMethods(1);
    expect(methods).toEqual(TIER_1_ALLOWED_METHODS);
    expect(methods).toContain("cash");
    expect(methods).toContain("cashapp");
    expect(methods).toContain("zelle");
    expect(methods).not.toContain("stripe");
  });

  it("returns Tier 2 methods for tier 2 users", () => {
    const methods = getAllowedPaymentMethods(2);
    expect(methods).toEqual(TIER_2_ALLOWED_METHODS);
    expect(methods).toContain("stripe");
  });

  it("returns Tier 2 methods for tiers above 2", () => {
    const methods = getAllowedPaymentMethods(3);
    expect(methods).toEqual(TIER_2_ALLOWED_METHODS);
  });

  it("returns Tier 1 methods for tier 0 (edge case)", () => {
    const methods = getAllowedPaymentMethods(0);
    expect(methods).toEqual(TIER_1_ALLOWED_METHODS);
  });

  it("returns Tier 1 methods for negative tier (edge case)", () => {
    const methods = getAllowedPaymentMethods(-1);
    expect(methods).toEqual(TIER_1_ALLOWED_METHODS);
  });

  it("Tier 1 never includes stripe", () => {
    const methods = getAllowedPaymentMethods(1);
    expect(methods).not.toContain("stripe");
  });

  it("Tier 2 is a superset of Tier 1", () => {
    const tier1 = getAllowedPaymentMethods(1);
    const tier2 = getAllowedPaymentMethods(2);
    for (const method of tier1) {
      expect(tier2).toContain(method);
    }
  });
});

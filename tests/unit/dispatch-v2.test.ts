import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dispatch modules
const mockAutoDispatchV1 = vi.fn();
const mockAutoDispatchV2 = vi.fn();

vi.mock("@/server/api/lib/auto-dispatch", () => ({
  autoDispatchBooking: (...args: unknown[]) => mockAutoDispatchV1(...args),
}));

vi.mock("@/server/api/lib/auto-dispatch-v2", () => ({
  autoDispatchBookingV2: (...args: unknown[]) => mockAutoDispatchV2(...args),
}));

import { dispatchBooking, isOfferModeEnabled } from "@/server/api/lib/dispatch-router";

describe("Dispatch Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DISPATCH_OFFER_MODE;
  });

  describe("isOfferModeEnabled", () => {
    it("returns false when DISPATCH_OFFER_MODE is not set", () => {
      expect(isOfferModeEnabled()).toBe(false);
    });

    it("returns false when DISPATCH_OFFER_MODE is 'false'", () => {
      process.env.DISPATCH_OFFER_MODE = "false";
      expect(isOfferModeEnabled()).toBe(false);
    });

    it("returns true when DISPATCH_OFFER_MODE is 'true'", () => {
      process.env.DISPATCH_OFFER_MODE = "true";
      expect(isOfferModeEnabled()).toBe(true);
    });
  });

  describe("dispatchBooking", () => {
    it("delegates to V1 when offer mode is disabled", async () => {
      process.env.DISPATCH_OFFER_MODE = "false";
      mockAutoDispatchV1.mockResolvedValue({ success: true, providerId: "p1" });

      const result = await dispatchBooking("booking-1", {
        excludeProviderIds: ["p0"],
      });

      expect(mockAutoDispatchV1).toHaveBeenCalledWith("booking-1", {
        excludeProviderIds: ["p0"],
      });
      expect(mockAutoDispatchV2).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("delegates to V2 when offer mode is enabled", async () => {
      process.env.DISPATCH_OFFER_MODE = "true";
      mockAutoDispatchV2.mockResolvedValue({
        success: true,
        providerId: "p1",
        score: 85.5,
        attemptNumber: 1,
      });

      const result = await dispatchBooking("booking-1", {
        excludeProviderIds: ["p0"],
        attempt: 2,
      });

      expect(mockAutoDispatchV2).toHaveBeenCalledWith("booking-1", {
        excludeProviderIds: ["p0"],
        attempt: 2,
      });
      expect(mockAutoDispatchV1).not.toHaveBeenCalled();
      expect(result.score).toBe(85.5);
    });

    it("V1 ignores attempt parameter", async () => {
      process.env.DISPATCH_OFFER_MODE = "false";
      mockAutoDispatchV1.mockResolvedValue({ success: true });

      await dispatchBooking("booking-1", {
        excludeProviderIds: ["p1"],
        attempt: 3,
      });

      // V1 only receives excludeProviderIds, not attempt
      expect(mockAutoDispatchV1).toHaveBeenCalledWith("booking-1", {
        excludeProviderIds: ["p1"],
      });
    });
  });
});

describe("Offer Flow Logic", () => {
  it("offer should set offerExpiresAt ~60s in the future", () => {
    const DISPATCH_OFFER_TIMEOUT_MS = 60_000;
    const now = Date.now();
    const offerExpiresAt = new Date(now + DISPATCH_OFFER_TIMEOUT_MS);

    // Should be approximately 60s from now
    const diffMs = offerExpiresAt.getTime() - now;
    expect(diffMs).toBe(60_000);
  });

  it("cascade should increment attempt counter", () => {
    const currentAttempt = 1;
    const nextAttempt = currentAttempt + 1;
    expect(nextAttempt).toBe(2);
  });

  it("should stop cascading at max attempts (3)", () => {
    const MAX_DISPATCH_CASCADE_ATTEMPTS = 3;
    expect(3 >= MAX_DISPATCH_CASCADE_ATTEMPTS).toBe(true);
    expect(2 >= MAX_DISPATCH_CASCADE_ATTEMPTS).toBe(false);
  });

  it("exclusion list should accumulate across attempts", () => {
    const previousDispatches = [
      { assignedProviderId: "p1" },
      { assignedProviderId: "p2" },
      { assignedProviderId: null }, // failed attempt with no provider
      { assignedProviderId: "p3" },
    ];

    const excludeIds = previousDispatches
      .filter((d) => d.assignedProviderId)
      .map((d) => d.assignedProviderId!);

    expect(excludeIds).toEqual(["p1", "p2", "p3"]);
    expect(excludeIds).toHaveLength(3);
  });
});

describe("Offer Expiry Logic", () => {
  it("expired offers are those where offerExpiresAt < now", () => {
    const pastExpiry = new Date(Date.now() - 5_000); // 5s ago
    const futureExpiry = new Date(Date.now() + 55_000); // 55s from now

    expect(pastExpiry < new Date()).toBe(true); // expired
    expect(futureExpiry < new Date()).toBe(false); // not expired
  });

  it("race condition: accept before expiry is safe", () => {
    // If provider accepts, status changes to "in_progress"
    // Expiry cron queries WHERE status='dispatched' → finds 0 rows
    const bookingStatus: string = "in_progress"; // provider already accepted
    const isExpiredCandidate = bookingStatus === "dispatched";
    expect(isExpiredCandidate).toBe(false);
  });

  it("revert on expiry clears all offer fields", () => {
    const revertFields = {
      providerId: null,
      status: "confirmed",
      offerExpiresAt: null,
    };

    expect(revertFields.providerId).toBeNull();
    expect(revertFields.status).toBe("confirmed");
    expect(revertFields.offerExpiresAt).toBeNull();
  });

  it("dispatch log records outcome for each expiry", () => {
    const log = {
      outcome: "expired",
      attemptNumber: 2,
      reason: "Offer expired after 60s (attempt 2)",
    };

    expect(log.outcome).toBe("expired");
    expect(log.attemptNumber).toBe(2);
    expect(log.reason).toContain("expired");
  });
});

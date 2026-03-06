import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkRateLimit,
  createRateLimitKey,
  RateLimitPresets,
} from "@/server/api/lib/rate-limiter";

describe("checkRateLimit", () => {
  beforeEach(() => {
    // Reset the internal store by advancing time past all windows
    vi.useFakeTimers();
  });

  it("allows first request", () => {
    const result = checkRateLimit("test:first", { maxRequests: 5, windowMs: 60000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("decrements remaining count", () => {
    const config = { maxRequests: 3, windowMs: 60000 };
    const key = "test:decrement";

    const r1 = checkRateLimit(key, config);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(key, config);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(key, config);
    expect(r3.remaining).toBe(0);
  });

  it("blocks when limit exceeded", () => {
    const config = { maxRequests: 2, windowMs: 60000 };
    const key = "test:block";

    checkRateLimit(key, config);
    checkRateLimit(key, config);

    const blocked = checkRateLimit(key, config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after window expires", () => {
    const config = { maxRequests: 1, windowMs: 1000 };
    const key = "test:reset";

    checkRateLimit(key, config);
    const blocked = checkRateLimit(key, config);
    expect(blocked.allowed).toBe(false);

    // Advance past window
    vi.advanceTimersByTime(1001);

    const afterReset = checkRateLimit(key, config);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(0);
  });

  it("tracks different keys independently", () => {
    const config = { maxRequests: 1, windowMs: 60000 };

    checkRateLimit("user:a", config);
    const blockedA = checkRateLimit("user:a", config);
    expect(blockedA.allowed).toBe(false);

    const userB = checkRateLimit("user:b", config);
    expect(userB.allowed).toBe(true);
  });

  it("provides resetMs within window", () => {
    const config = { maxRequests: 5, windowMs: 60000 };
    const key = "test:resetMs";

    checkRateLimit(key, config);
    vi.advanceTimersByTime(10000);

    const result = checkRateLimit(key, config);
    expect(result.resetMs).toBeGreaterThan(0);
    expect(result.resetMs).toBeLessThanOrEqual(60000);
  });
});

describe("createRateLimitKey", () => {
  it("combines identifier and endpoint", () => {
    expect(createRateLimitKey("192.168.1.1", "/api/bookings")).toBe(
      "192.168.1.1:/api/bookings"
    );
  });

  it("handles user IDs", () => {
    expect(createRateLimitKey("user_abc123", "/api/payments")).toBe(
      "user_abc123:/api/payments"
    );
  });
});

describe("RateLimitPresets", () => {
  it("has standard preset (100/min)", () => {
    expect(RateLimitPresets.standard).toEqual({
      maxRequests: 100,
      windowMs: 60000,
    });
  });

  it("has strict preset (20/min)", () => {
    expect(RateLimitPresets.strict).toEqual({
      maxRequests: 20,
      windowMs: 60000,
    });
  });

  it("has auth preset (10/5min)", () => {
    expect(RateLimitPresets.auth).toEqual({
      maxRequests: 10,
      windowMs: 300000,
    });
  });

  it("has notifications preset (5/min)", () => {
    expect(RateLimitPresets.notifications).toEqual({
      maxRequests: 5,
      windowMs: 60000,
    });
  });

  it("has webhooks preset (200/min)", () => {
    expect(RateLimitPresets.webhooks).toEqual({
      maxRequests: 200,
      windowMs: 60000,
    });
  });
});

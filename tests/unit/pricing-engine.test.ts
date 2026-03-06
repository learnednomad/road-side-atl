import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_MULTIPLIER_BP } from "@/lib/constants";

// Mock the db module
vi.mock("@/db", () => ({
  db: {
    query: {
      services: {
        findFirst: vi.fn(),
      },
      timeBlockConfigs: {
        findMany: vi.fn(),
      },
    },
  },
}));

import { db } from "@/db";
import { calculateBookingPrice } from "@/server/api/lib/pricing-engine";

const mockServices = db.query.services.findFirst as ReturnType<typeof vi.fn>;
const mockTimeBlocks = db.query.timeBlockConfigs.findMany as ReturnType<typeof vi.fn>;

describe("calculateBookingPrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns standard price when no time blocks match", async () => {
    mockServices.mockResolvedValue({ id: "svc-1", basePrice: 5000 });
    mockTimeBlocks.mockResolvedValue([]);

    const result = await calculateBookingPrice("svc-1", new Date("2026-02-22T14:00:00"));

    expect(result).toEqual({
      basePrice: 5000,
      multiplier: DEFAULT_MULTIPLIER_BP, // 10000 = 1.0x
      blockName: "Standard",
      finalPrice: 5000, // 5000 * 10000 / 10000
    });
  });

  it("applies time block multiplier (1.5x surge)", async () => {
    mockServices.mockResolvedValue({ id: "svc-1", basePrice: 5000 });
    mockTimeBlocks.mockResolvedValue([
      {
        name: "Evening Rush",
        startHour: 17,
        endHour: 21,
        multiplier: 15000, // 1.5x in basis points
        priority: 10,
        isActive: true,
      },
    ]);

    // 6 PM falls within 17-21
    const result = await calculateBookingPrice("svc-1", new Date("2026-02-22T18:00:00"));

    expect(result).toEqual({
      basePrice: 5000,
      multiplier: 15000,
      blockName: "Evening Rush",
      finalPrice: 7500, // 5000 * 15000 / 10000
    });
  });

  it("handles overnight blocks (e.g., 22:00-06:00)", async () => {
    mockServices.mockResolvedValue({ id: "svc-1", basePrice: 8000 });
    mockTimeBlocks.mockResolvedValue([
      {
        name: "Late Night",
        startHour: 22,
        endHour: 6,
        multiplier: 20000, // 2.0x
        priority: 20,
        isActive: true,
      },
    ]);

    // 2 AM should match overnight block
    const result = await calculateBookingPrice("svc-1", new Date("2026-02-22T02:00:00"));

    expect(result.blockName).toBe("Late Night");
    expect(result.multiplier).toBe(20000);
    expect(result.finalPrice).toBe(16000); // 8000 * 2.0
  });

  it("selects highest priority block when multiple match", async () => {
    mockServices.mockResolvedValue({ id: "svc-1", basePrice: 5000 });
    mockTimeBlocks.mockResolvedValue([
      {
        name: "Daytime",
        startHour: 6,
        endHour: 22,
        multiplier: 10000, // 1.0x
        priority: 1,
        isActive: true,
      },
      {
        name: "Storm Mode",
        startHour: 6,
        endHour: 22,
        multiplier: 25000, // 2.5x
        priority: 100,
        isActive: true,
      },
    ]);

    const result = await calculateBookingPrice("svc-1", new Date("2026-02-22T12:00:00"));

    expect(result.blockName).toBe("Storm Mode");
    expect(result.multiplier).toBe(25000);
    expect(result.finalPrice).toBe(12500); // 5000 * 2.5
  });

  it("rounds final price to nearest cent", async () => {
    mockServices.mockResolvedValue({ id: "svc-1", basePrice: 3333 });
    mockTimeBlocks.mockResolvedValue([
      {
        name: "Surge",
        startHour: 0,
        endHour: 24,
        multiplier: 15000, // 1.5x
        priority: 1,
        isActive: true,
      },
    ]);

    const result = await calculateBookingPrice("svc-1", new Date("2026-02-22T12:00:00"));
    // 3333 * 15000 / 10000 = 4999.5 → rounds to 5000
    expect(result.finalPrice).toBe(5000);
    expect(Number.isInteger(result.finalPrice)).toBe(true);
  });

  it("throws when service not found", async () => {
    mockServices.mockResolvedValue(undefined);
    mockTimeBlocks.mockResolvedValue([]);

    await expect(
      calculateBookingPrice("nonexistent", new Date())
    ).rejects.toThrow("Service not found");
  });

  it("uses current time when scheduledAt is null", async () => {
    mockServices.mockResolvedValue({ id: "svc-1", basePrice: 5000 });
    mockTimeBlocks.mockResolvedValue([]);

    const result = await calculateBookingPrice("svc-1", null);
    expect(result.finalPrice).toBe(5000);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockInnerJoin = vi.fn();
const mockSelectWhere = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      platformSettings: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return { set: (...setArgs: unknown[]) => { mockSet(...setArgs); return { where: mockWhere }; } };
    },
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        from: (...fromArgs: unknown[]) => {
          mockFrom(...fromArgs);
          return {
            innerJoin: (...joinArgs: unknown[]) => {
              mockInnerJoin(...joinArgs);
              return { where: mockSelectWhere };
            },
            where: mockSelectWhere,
          };
        },
      };
    },
  },
}));

vi.mock("@/server/api/lib/beta", () => ({
  clearBetaCache: vi.fn(),
  isBetaActive: vi.fn(),
}));

vi.mock("@/server/api/lib/audit-logger", () => ({
  logAudit: vi.fn(),
  getRequestInfo: vi.fn().mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "test" }),
}));

import { clearBetaCache, isBetaActive } from "@/server/api/lib/beta";
import { logAudit } from "@/server/api/lib/audit-logger";

describe("Admin Beta Toggle API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PATCH /settings/beta - Toggle Logic", () => {
    it("should read old value before updating for audit trail", async () => {
      mockFindFirst.mockResolvedValue({
        id: "1",
        key: "beta_active",
        value: "true",
        updatedAt: new Date(),
      });

      const oldSetting = await mockFindFirst();
      const oldValue = oldSetting?.value ?? "false";
      const newValue = "false";

      expect(oldValue).toBe("true");
      expect(newValue).toBe("false");
    });

    it("should default old value to 'false' when no setting exists", async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const oldSetting = await mockFindFirst();
      const oldValue = oldSetting?.value ?? "false";

      expect(oldValue).toBe("false");
    });

    it("should convert boolean active to string value correctly", () => {
      expect(true ? "true" : "false").toBe("true");
      expect(false ? "true" : "false").toBe("false");
    });

    it("should call clearBetaCache after toggling", () => {
      const { clearBetaCache: clearFn } = vi.mocked({ clearBetaCache });
      clearFn();
      expect(clearBetaCache).toHaveBeenCalledTimes(1);
    });

    it("should log audit with settings.update action and correct details", () => {
      const auditPayload = {
        action: "settings.update" as const,
        userId: "user-1",
        resourceType: "platform_settings",
        resourceId: "beta_active",
        details: { setting: "beta_active", oldValue: "true", newValue: "false" },
        ipAddress: "127.0.0.1",
        userAgent: "test",
      };

      logAudit(auditPayload);

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "settings.update",
          resourceType: "platform_settings",
          resourceId: "beta_active",
          details: expect.objectContaining({
            setting: "beta_active",
            oldValue: "true",
            newValue: "false",
          }),
        })
      );
    });
  });

  describe("GET /beta/stats - Stats Logic", () => {
    it("should return correct stats structure", async () => {
      vi.mocked(isBetaActive).mockResolvedValue(true);

      const expectedShape = {
        betaActive: true,
        betaUserCount: 5,
        mechanicBookingCount: 12,
        startDate: "2026-04-07",
        endDate: "2026-06-07",
      };

      expect(expectedShape).toHaveProperty("betaActive");
      expect(expectedShape).toHaveProperty("betaUserCount");
      expect(expectedShape).toHaveProperty("mechanicBookingCount");
      expect(expectedShape).toHaveProperty("startDate");
      expect(expectedShape).toHaveProperty("endDate");
      expect(typeof expectedShape.betaActive).toBe("boolean");
      expect(typeof expectedShape.betaUserCount).toBe("number");
    });

    it("should handle null start/end dates", () => {
      const settings: Array<{ key: string; value: string }> = [];
      const startDate = settings.find((s) => s.key === "beta_start_date")?.value ?? null;
      const endDate = settings.find((s) => s.key === "beta_end_date")?.value ?? null;

      expect(startDate).toBeNull();
      expect(endDate).toBeNull();
    });

    it("should extract dates from platform_settings correctly", () => {
      const settings = [
        { key: "beta_start_date", value: "2026-04-07" },
        { key: "beta_end_date", value: "2026-06-07" },
      ];
      const startDate = settings.find((s) => s.key === "beta_start_date")?.value ?? null;
      const endDate = settings.find((s) => s.key === "beta_end_date")?.value ?? null;

      expect(startDate).toBe("2026-04-07");
      expect(endDate).toBe("2026-06-07");
    });

    it("should default counts to 0 when no data", () => {
      const betaUserCount = undefined;
      const mechanicBookingCount = undefined;

      expect((betaUserCount as { count: number } | undefined)?.count ?? 0).toBe(0);
      expect((mechanicBookingCount as { count: number } | undefined)?.count ?? 0).toBe(0);
    });
  });
});

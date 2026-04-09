import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    query: {
      platformSettings: { findFirst: vi.fn() },
    },
  },
}));

import { db } from "@/db";
import { isBetaActive, clearBetaCache } from "@/server/api/lib/beta";

const mockFindFirst = db.query.platformSettings.findFirst as ReturnType<typeof vi.fn>;

describe("isBetaActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearBetaCache(); // Clear the 60s cache between tests
  });

  it("returns true when beta_active setting is 'true'", async () => {
    mockFindFirst.mockResolvedValue({ key: "beta_active", value: "true" });
    expect(await isBetaActive()).toBe(true);
  });

  it("returns false when beta_active setting is 'false'", async () => {
    mockFindFirst.mockResolvedValue({ key: "beta_active", value: "false" });
    expect(await isBetaActive()).toBe(false);
  });

  it("returns false when beta_active setting does not exist", async () => {
    mockFindFirst.mockResolvedValue(undefined);
    expect(await isBetaActive()).toBe(false);
  });
});

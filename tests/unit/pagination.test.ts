import { describe, it, expect } from "vitest";
import { parsePagination } from "@/server/api/lib/pagination";

describe("parsePagination", () => {
  it("defaults to page 1, limit 20", () => {
    expect(parsePagination(undefined, undefined)).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it("parses valid values and computes offset", () => {
    expect(parsePagination("3", "10")).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it("guards NaN (non-numeric) input back to defaults", () => {
    expect(parsePagination("abc", "xyz")).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it("clamps page to >= 1 and limit to >= 1", () => {
    expect(parsePagination("0", "0")).toMatchObject({ page: 1, limit: 20 });
    expect(parsePagination("-5", "-5")).toMatchObject({ page: 1, limit: 1 });
  });

  it("caps limit at maxLimit (resource exhaustion guard)", () => {
    expect(parsePagination("1", "100000").limit).toBe(100);
    expect(parsePagination("1", "100000", { maxLimit: 50 }).limit).toBe(50);
  });

  it("honors a custom default limit", () => {
    expect(parsePagination(undefined, undefined, { defaultLimit: 25 }).limit).toBe(25);
  });
});

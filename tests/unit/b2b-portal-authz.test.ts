import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirst, resolveUser } = vi.hoisted(() => ({ findFirst: vi.fn(), resolveUser: vi.fn() }));
vi.mock("@/db", () => ({ db: { query: { b2bAccountMembers: { findFirst } } } }));
vi.mock("@/server/api/middleware/auth", () => ({ resolveUser }));

import { requireB2bMember, requireB2bRole } from "@/server/api/middleware/b2b-member";

function makeCtx() {
  const vars: Record<string, unknown> = {};
  return {
    vars,
    set: (k: string, v: unknown) => { vars[k] = v; },
    get: (k: string) => vars[k],
    json: (body: unknown, status?: number) => ({ __json: body, __status: status ?? 200 }),
    req: { header: () => undefined },
  };
}

describe("requireB2bMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401s when not authenticated", async () => {
    resolveUser.mockResolvedValue(null);
    const c = makeCtx();
    const res = await (requireB2bMember as never as (c: unknown, n: () => Promise<void>) => Promise<{ __status: number }>)(c, async () => {});
    expect(res.__status).toBe(401);
  });

  it("403s when the user is not a member of any account", async () => {
    resolveUser.mockResolvedValue({ id: "u1", role: "user" });
    findFirst.mockResolvedValue(undefined);
    const c = makeCtx();
    const res = await (requireB2bMember as never as (c: unknown, n: () => Promise<void>) => Promise<{ __status: number }>)(c, async () => {});
    expect(res.__status).toBe(403);
  });

  it("pins b2bAccountId from the membership (never client input)", async () => {
    resolveUser.mockResolvedValue({ id: "u1", role: "user" });
    findFirst.mockResolvedValue({ accountId: "acct-A", userId: "u1", role: "manager" });
    const c = makeCtx();
    let nextCalled = false;
    await (requireB2bMember as never as (c: unknown, n: () => Promise<void>) => Promise<void>)(c, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(c.get("b2bAccountId")).toBe("acct-A"); // from membership, not request
    expect(c.get("b2bRole")).toBe("manager");
  });
});

describe("requireB2bRole", () => {
  it("403s when the member's role is not permitted", async () => {
    const c = makeCtx();
    c.set("b2bRole", "member");
    const mw = requireB2bRole("owner");
    const res = await (mw as never as (c: unknown, n: () => Promise<void>) => Promise<{ __status: number }>)(c, async () => {});
    expect(res.__status).toBe(403);
  });

  it("allows a permitted role through", async () => {
    const c = makeCtx();
    c.set("b2bRole", "owner");
    let nextCalled = false;
    await (requireB2bRole("owner", "manager") as never as (c: unknown, n: () => Promise<void>) => Promise<void>)(c, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });
});

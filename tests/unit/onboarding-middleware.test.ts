import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories are hoisted, no outer variable references allowed
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      providers: { findFirst: vi.fn() },
    },
  },
}));

vi.mock("@/db/schema", () => ({
  providers: { userId: "userId", id: "id", status: "status" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ _op: "eq", args })),
}));

vi.mock("@/server/api/lib/audit-logger", () => ({
  logAudit: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { logAudit } from "@/server/api/lib/audit-logger";
import { requireOnboardingComplete } from "@/server/api/middleware/onboarding";

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockProvidersFindFirst = db.query.providers.findFirst as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Test app — middleware under test + a dummy route
// ---------------------------------------------------------------------------

function createTestApp() {
  const app = new Hono();
  app.use("/*", requireOnboardingComplete);
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
}

function makeGetRequest(path = "/test") {
  return new Request(`http://localhost${path}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("requireOnboardingComplete middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes through when provider status is active", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "provider" } });
    mockProvidersFindFirst.mockResolvedValue({ id: "p1", status: "active", migrationBypassExpiresAt: null });

    const app = createTestApp();
    const res = await app.fetch(makeGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("returns 403 for provider with onboarding status", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "provider" } });
    mockProvidersFindFirst.mockResolvedValue({ id: "p1", status: "onboarding", migrationBypassExpiresAt: null });

    const app = createTestApp();
    const res = await app.fetch(makeGetRequest());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Onboarding not complete");
    expect(json.redirect).toBe("/provider/onboarding");
  });

  it("returns 403 for provider with pending_review status", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "provider" } });
    mockProvidersFindFirst.mockResolvedValue({ id: "p1", status: "pending_review", migrationBypassExpiresAt: null });

    const app = createTestApp();
    const res = await app.fetch(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it("passes through with valid migration bypass and logs audit", async () => {
    const futureDate = new Date(Date.now() + 86400000);
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "provider" } });
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1",
      status: "onboarding",
      migrationBypassExpiresAt: futureDate,
    });

    const app = createTestApp();
    const res = await app.fetch(makeGetRequest());
    expect(res.status).toBe(200);

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "onboarding.migration_bypass",
        userId: "u1",
        resourceType: "provider",
        resourceId: "p1",
      })
    );
  });

  it("returns 403 for expired migration bypass", async () => {
    const pastDate = new Date(Date.now() - 86400000);
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "provider" } });
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1",
      status: "onboarding",
      migrationBypassExpiresAt: pastDate,
    });

    const app = createTestApp();
    const res = await app.fetch(makeGetRequest());
    expect(res.status).toBe(403);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("passes through for non-provider roles (lets downstream auth handle)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "admin" } });

    const app = createTestApp();
    const res = await app.fetch(makeGetRequest());
    expect(res.status).toBe(200);
    expect(mockProvidersFindFirst).not.toHaveBeenCalled();
  });

  it("passes through when no session exists", async () => {
    mockAuth.mockResolvedValue(null);

    const app = createTestApp();
    const res = await app.fetch(makeGetRequest());
    expect(res.status).toBe(200);
    expect(mockProvidersFindFirst).not.toHaveBeenCalled();
  });

  it("returns 404 when provider record not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "provider" } });
    mockProvidersFindFirst.mockResolvedValue(null);

    const app = createTestApp();
    const res = await app.fetch(makeGetRequest());
    expect(res.status).toBe(404);
  });
});

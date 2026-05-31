/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("@/db", () => ({
  db: {
    query: {
      providers: { findFirst: vi.fn() },
      onboardingSteps: { findFirst: vi.fn() },
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/server/api/lib/audit-logger", () => ({
  logAudit: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { Hono } from "hono";
import { db } from "@/db";
import { requireIcAgreementAccepted } from "@/server/api/middleware/onboarding";

function makeApp() {
  const app = new Hono<{ Variables: { user: { id: string; role: string } } }>();
  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1", role: "provider" });
    await next();
  });
  app.patch("/jobs/:id/accept", requireIcAgreementAccepted, (c) =>
    c.json({ ok: true }),
  );
  return app;
}

describe("requireIcAgreementAccepted middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows the request when ic_agreement step is complete", async () => {
    (db.query.providers.findFirst as any).mockResolvedValue({
      id: "p1",
      userId: "user-1",
    });
    (db.query.onboardingSteps.findFirst as any).mockResolvedValue({
      id: "step-ic",
      providerId: "p1",
      stepType: "ic_agreement",
      status: "complete",
    });

    const res = await makeApp().request("/jobs/booking-1/accept", { method: "PATCH" });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("blocks with 403 + agreement_required code when step is pending", async () => {
    (db.query.providers.findFirst as any).mockResolvedValue({
      id: "p1",
      userId: "user-1",
    });
    (db.query.onboardingSteps.findFirst as any).mockResolvedValue({
      id: "step-ic",
      providerId: "p1",
      stepType: "ic_agreement",
      status: "pending",
    });

    const res = await makeApp().request("/jobs/booking-1/accept", { method: "PATCH" });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("ic_agreement_required");
    expect(json.redirect).toBe("/provider/onboarding/agreement");
  });

  it("blocks with 403 when step row is missing entirely", async () => {
    (db.query.providers.findFirst as any).mockResolvedValue({
      id: "p1",
      userId: "user-1",
    });
    (db.query.onboardingSteps.findFirst as any).mockResolvedValue(undefined);

    const res = await makeApp().request("/jobs/booking-1/accept", { method: "PATCH" });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("ic_agreement_required");
  });

  it("returns 404 when the provider record does not exist", async () => {
    (db.query.providers.findFirst as any).mockResolvedValue(undefined);

    const res = await makeApp().request("/jobs/booking-1/accept", { method: "PATCH" });

    expect(res.status).toBe(404);
  });
});

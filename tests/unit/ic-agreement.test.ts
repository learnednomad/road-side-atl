/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("@/db", () => ({
  db: {
    query: {
      providers: { findFirst: vi.fn() },
      onboardingSteps: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    update: vi.fn(),
  },
}));

vi.mock("@/server/api/lib/audit-logger", () => ({
  logAudit: vi.fn(),
  getRequestInfo: vi.fn().mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "test" }),
}));

vi.mock("@/server/api/lib/all-steps-complete", () => ({
  checkAllStepsCompleteAndTransition: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/server/api/lib/onboarding-state-machine", () => ({
  isValidProviderTransition: vi.fn().mockReturnValue(true),
  isValidStepTransition: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: { accounts: { create: vi.fn(), createLoginLink: vi.fn() } },
  getStripe: vi.fn(),
}));

vi.mock("@/server/api/lib/checkr", () => ({
  createCandidate: vi.fn(),
  createInvitation: vi.fn(),
  CheckrApiError: class extends Error {},
}));

vi.mock("@/lib/s3", () => ({
  getPresignedUploadUrl: vi.fn(),
  getPresignedUrl: vi.fn(),
}));

vi.mock("@/lib/constants", () => ({
  ONBOARDING_STEP_TYPES: [
    "ic_agreement",
    "background_check",
    "insurance",
    "certifications",
    "training",
    "stripe_connect",
  ],
  IC_AGREEMENT_VERSION: "v1.0.0",
  REAPPLY_COOLDOWN_DAYS: 30,
  PRESIGNED_UPLOAD_EXPIRY: 900,
  PRESIGNED_DOWNLOAD_EXPIRY_PROVIDER: 3600,
  MIN_DOCUMENTS_PER_STEP: 1,
  CHECKR_PACKAGE: "driver_pro",
}));

vi.mock("@/server/api/middleware/auth", () => ({
  requireProvider: vi.fn().mockImplementation(async (c: any, next: any) => {
    c.set("user", { id: "user-1", role: "provider" });
    await next();
  }),
}));

vi.mock("@/server/api/middleware/rate-limit", () => ({
  rateLimitStrict: vi.fn().mockImplementation(async (_c: any, next: any) => next()),
}));

// ── Imports ──────────────────────────────────────────────────────

import { db } from "@/db";
import { logAudit } from "@/server/api/lib/audit-logger";
import { checkAllStepsCompleteAndTransition } from "@/server/api/lib/all-steps-complete";

// ── Tests ────────────────────────────────────────────────────────

describe("IC Agreement", () => {
  describe("GET /ic-agreement", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns agreement text + step status for a fresh provider", async () => {
      (db.query.providers.findFirst as any).mockResolvedValue({ id: "p1", userId: "user-1" });
      (db.query.onboardingSteps.findFirst as any).mockResolvedValue({
        id: "step-ic",
        providerId: "p1",
        stepType: "ic_agreement",
        status: "pending",
        draftData: null,
      });

      const { default: app } = await import("@/server/api/routes/onboarding");
      const res = await app.request("/ic-agreement");

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.agreement.version).toBe("v1.0.0");
      expect(json.agreement.title).toBe("Independent Contractor Agreement");
      expect(json.agreement.sections.length).toBeGreaterThan(0);
      expect(json.step.status).toBe("pending");
      expect(json.step.acceptedVersion).toBeNull();
    });

    it("surfaces prior acceptance metadata when step is complete", async () => {
      (db.query.providers.findFirst as any).mockResolvedValue({ id: "p1", userId: "user-1" });
      (db.query.onboardingSteps.findFirst as any).mockResolvedValue({
        id: "step-ic",
        providerId: "p1",
        stepType: "ic_agreement",
        status: "complete",
        draftData: {
          version: "v1.0.0",
          acceptedAt: "2026-05-31T12:00:00.000Z",
          signedName: "Jane Smith",
          ipAddress: "127.0.0.1",
          userAgent: "test",
        },
      });

      const { default: app } = await import("@/server/api/routes/onboarding");
      const res = await app.request("/ic-agreement");
      const json = await res.json();

      expect(json.step.status).toBe("complete");
      expect(json.step.acceptedVersion).toBe("v1.0.0");
      expect(json.step.signedName).toBe("Jane Smith");
    });
  });

  describe("POST /ic-agreement/accept", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    function mockUpdateReturning(row: unknown) {
      const mockReturning = vi.fn().mockResolvedValue([row]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });
    }

    it("accepts agreement, marks step complete, audits, broadcasts, and checks all-steps-complete", async () => {
      (db.query.providers.findFirst as any).mockResolvedValue({
        id: "p1",
        userId: "user-1",
        name: "Jane Smith",
        status: "onboarding",
      });
      (db.query.onboardingSteps.findFirst as any).mockResolvedValue({
        id: "step-ic",
        providerId: "p1",
        stepType: "ic_agreement",
        status: "pending",
        draftData: null,
      });

      mockUpdateReturning({
        id: "step-ic",
        status: "complete",
        draftData: {
          version: "v1.0.0",
          signedName: "Jane Smith",
        },
      });

      const { default: app } = await import("@/server/api/routes/onboarding");
      const res = await app.request("/ic-agreement/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: "v1.0.0", signedName: "Jane Smith" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.step.status).toBe("complete");

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ic_agreement.accepted",
          details: expect.objectContaining({
            version: "v1.0.0",
            signedName: "Jane Smith",
          }),
        }),
      );
      expect(checkAllStepsCompleteAndTransition).toHaveBeenCalledWith(
        "p1",
        "step-ic",
        "ic_agreement.accepted",
        expect.any(Object),
        expect.objectContaining({ id: "p1" }),
      );
    });

    it("rejects stale agreement version with 409", async () => {
      const { default: app } = await import("@/server/api/routes/onboarding");
      const res = await app.request("/ic-agreement/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: "v0.9.0", signedName: "Jane Smith" }),
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.currentVersion).toBe("v1.0.0");
      expect(db.update).not.toHaveBeenCalled();
    });

    it("rejects re-acceptance when step is already complete", async () => {
      (db.query.providers.findFirst as any).mockResolvedValue({ id: "p1", userId: "user-1" });
      (db.query.onboardingSteps.findFirst as any).mockResolvedValue({
        id: "step-ic",
        providerId: "p1",
        stepType: "ic_agreement",
        status: "complete",
        draftData: { version: "v1.0.0", signedName: "Jane Smith" },
      });

      const { default: app } = await import("@/server/api/routes/onboarding");
      const res = await app.request("/ic-agreement/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: "v1.0.0", signedName: "Jane Smith" }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Agreement already accepted");
      expect(db.update).not.toHaveBeenCalled();
    });

    it("rejects empty signed name with 400", async () => {
      const { default: app } = await import("@/server/api/routes/onboarding");
      const res = await app.request("/ic-agreement/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: "v1.0.0", signedName: " " }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid input");
    });
  });
});

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

vi.mock("@/server/websocket/broadcast", () => ({
  broadcastToUser: vi.fn(),
  broadcastToAdmins: vi.fn(),
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
  ONBOARDING_STEP_TYPES: ["background_check", "insurance", "certifications", "training", "stripe_connect"],
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
import { broadcastToUser } from "@/server/websocket/broadcast";
import { checkAllStepsCompleteAndTransition } from "@/server/api/lib/all-steps-complete";
import { TRAINING_CARDS, TOTAL_TRAINING_CARDS } from "@/lib/training-content";

// ── Tests ────────────────────────────────────────────────────────

describe("Training Module", () => {
  describe("Training Content", () => {
    it("has 11 training cards", () => {
      expect(TOTAL_TRAINING_CARDS).toBe(11);
      expect(TRAINING_CARDS).toHaveLength(11);
    });

    it("covers all 4 categories", () => {
      const categories = new Set(TRAINING_CARDS.map((c) => c.category));
      expect(categories).toEqual(new Set(["safety", "service", "policy", "payment"]));
    });

    it("each card has id, title, content, and keyPoints", () => {
      for (const card of TRAINING_CARDS) {
        expect(card.id).toBeTruthy();
        expect(card.title).toBeTruthy();
        expect(card.content.length).toBeGreaterThan(50);
        expect(card.keyPoints.length).toBeGreaterThan(0);
      }
    });

    it("all card IDs are unique", () => {
      const ids = TRAINING_CARDS.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("GET /training", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns training cards with acknowledgment status", async () => {
      (db.query.providers.findFirst as any).mockResolvedValue({ id: "p1", userId: "user-1" });
      (db.query.onboardingSteps.findFirst as any).mockResolvedValue({
        id: "step-4",
        providerId: "p1",
        stepType: "training",
        status: "draft",
        draftData: { acknowledgedCards: ["safety-scene"] },
      });

      const { default: app } = await import("@/server/api/routes/onboarding");
      const res = await app.request("/training", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.totalCards).toBe(11);
      expect(json.acknowledgedCount).toBe(1);
      expect(json.acknowledgedCards).toEqual(["safety-scene"]);
      expect(json.cards).toHaveLength(11);

      const acknowledged = json.cards.find((c: any) => c.id === "safety-scene");
      expect(acknowledged.acknowledged).toBe(true);

      const unacknowledged = json.cards.find((c: any) => c.id === "safety-vehicle");
      expect(unacknowledged.acknowledged).toBe(false);
    });

    it("returns empty acknowledgments for new providers", async () => {
      (db.query.providers.findFirst as any).mockResolvedValue({ id: "p1", userId: "user-1" });
      (db.query.onboardingSteps.findFirst as any).mockResolvedValue({
        id: "step-4",
        providerId: "p1",
        stepType: "training",
        status: "pending",
        draftData: null,
      });

      const { default: app } = await import("@/server/api/routes/onboarding");
      const res = await app.request("/training");
      const json = await res.json();

      expect(json.acknowledgedCount).toBe(0);
      expect(json.acknowledgedCards).toEqual([]);
    });
  });

  describe("POST /training/acknowledge/:cardId", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("acknowledges a card and saves to draftData", async () => {
      (db.query.providers.findFirst as any).mockResolvedValue({ id: "p1", userId: "user-1" });
      (db.query.onboardingSteps.findFirst as any).mockResolvedValue({
        id: "step-4",
        providerId: "p1",
        stepType: "training",
        status: "pending",
        draftData: null,
      });

      const mockReturning = vi.fn().mockResolvedValue([{
        id: "step-4",
        status: "draft",
        draftData: { acknowledgedCards: ["safety-scene"] },
      }]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });
      (db.query.onboardingSteps.findMany as any).mockResolvedValue([]);

      const { default: app } = await import("@/server/api/routes/onboarding");
      const res = await app.request("/training/acknowledge/safety-scene", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.acknowledgedCount).toBe(1);
      expect(json.isComplete).toBe(false);
      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: "training.card_acknowledged",
      }));
    });

    it("rejects invalid card ID", async () => {
      const { default: app } = await import("@/server/api/routes/onboarding");
      const res = await app.request("/training/acknowledge/nonexistent-card", {
        method: "POST",
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid training card ID");
    });

    it("rejects if training already complete", async () => {
      (db.query.providers.findFirst as any).mockResolvedValue({ id: "p1", userId: "user-1" });
      (db.query.onboardingSteps.findFirst as any).mockResolvedValue({
        id: "step-4",
        providerId: "p1",
        stepType: "training",
        status: "complete",
        draftData: { acknowledgedCards: TRAINING_CARDS.map((c) => c.id) },
      });

      const { default: app } = await import("@/server/api/routes/onboarding");
      const res = await app.request("/training/acknowledge/safety-scene", {
        method: "POST",
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Training already completed");
    });

    it("auto-completes when all cards acknowledged", async () => {
      const allButOne = TRAINING_CARDS.slice(0, -1).map((c) => c.id);
      const lastCard = TRAINING_CARDS[TRAINING_CARDS.length - 1];

      (db.query.providers.findFirst as any).mockResolvedValue({ id: "p1", userId: "user-1" });
      (db.query.onboardingSteps.findFirst as any).mockResolvedValue({
        id: "step-4",
        providerId: "p1",
        stepType: "training",
        status: "draft",
        draftData: { acknowledgedCards: allButOne },
      });

      const mockReturning = vi.fn().mockResolvedValue([{
        id: "step-4",
        status: "complete",
        draftData: { acknowledgedCards: [...allButOne, lastCard.id] },
      }]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });
      (db.query.onboardingSteps.findMany as any).mockResolvedValue([]);

      const { default: app } = await import("@/server/api/routes/onboarding");
      const res = await app.request(`/training/acknowledge/${lastCard.id}`, {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.isComplete).toBe(true);
      expect(json.acknowledgedCount).toBe(TOTAL_TRAINING_CARDS);

      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: "training.module_completed",
      }));
      expect(broadcastToUser).toHaveBeenCalledWith("user-1", expect.objectContaining({
        type: "onboarding:step_updated",
      }));
      expect(checkAllStepsCompleteAndTransition).toHaveBeenCalledWith(
        "p1", "step-4", "training.all_cards_acknowledged",
        expect.objectContaining({ userId: "user-1" }),
      );
    });
  });
});

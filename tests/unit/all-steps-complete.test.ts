import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ───────────────────────────────────────────────────

let mockUpdateReturnValues: unknown[][] = [];

const createUpdateChain = () => {
  const returning = vi.fn().mockImplementation(() =>
    Promise.resolve(mockUpdateReturnValues.shift() || []),
  );
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  return { set, where, returning };
};

let updateChain = createUpdateChain();

vi.mock("@/db", () => ({
  db: {
    query: {
      providers: { findFirst: vi.fn() },
      onboardingSteps: { findMany: vi.fn() },
    },
    update: vi.fn().mockImplementation(() => ({ set: updateChain.set })),
  },
}));

vi.mock("@/db/schema/onboarding-steps", () => ({
  onboardingSteps: { providerId: "providerId" },
}));

vi.mock("@/db/schema/providers", () => ({
  providers: { id: "id", status: "status" },
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual("drizzle-orm");
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => ({ _op: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ _op: "and", args })),
  };
});

vi.mock("@/server/api/lib/audit-logger", () => ({
  logAudit: vi.fn(),
}));

vi.mock("@/server/websocket/broadcast", () => ({
  broadcastToAdmins: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  notifyAdminProviderReadyForReview: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports ──────────────────────────────────────────────────────

import { db } from "@/db";
import { logAudit } from "@/server/api/lib/audit-logger";
import { broadcastToAdmins } from "@/server/websocket/broadcast";
import { checkAllStepsCompleteAndTransition } from "@/server/api/lib/all-steps-complete";

// ── Tests ────────────────────────────────────────────────────────

describe("checkAllStepsCompleteAndTransition", () => {
  const mockProvider = {
    id: "provider-1",
    name: "Test Provider",
    status: "onboarding",
    userId: "user-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateReturnValues = [];
    updateChain = createUpdateChain();
    (db.update as ReturnType<typeof vi.fn>).mockImplementation(() => ({ set: updateChain.set }));
  });

  it("returns false when provider not found (no existingProvider)", async () => {
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await checkAllStepsCompleteAndTransition(
      "provider-1", "step-1", "test",
    );

    expect(result).toBe(false);
    expect(db.query.onboardingSteps.findMany).not.toHaveBeenCalled();
  });

  it("returns false when provider status is not onboarding", async () => {
    const result = await checkAllStepsCompleteAndTransition(
      "provider-1", "step-1", "test",
      undefined,
      { ...mockProvider, status: "active" },
    );

    expect(result).toBe(false);
    expect(db.query.onboardingSteps.findMany).not.toHaveBeenCalled();
  });

  it("returns false when not all steps are complete", async () => {
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "step-1", status: "complete" },
      { id: "step-2", status: "in_progress" },
    ]);

    const result = await checkAllStepsCompleteAndTransition(
      "provider-1", "step-1", "test",
      undefined, mockProvider,
    );

    expect(result).toBe(false);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("treats completedStepId as complete even if DB shows otherwise", async () => {
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "step-1", status: "in_progress" }, // Just completed but DB not yet updated
      { id: "step-2", status: "complete" },
    ]);
    mockUpdateReturnValues.push([{ id: "provider-1", status: "pending_review" }]);

    const result = await checkAllStepsCompleteAndTransition(
      "provider-1", "step-1", "test",
      undefined, mockProvider,
    );

    expect(result).toBe(true);
  });

  it("transitions provider to pending_review when all steps complete", async () => {
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "step-1", status: "complete" },
      { id: "step-2", status: "complete" },
    ]);
    mockUpdateReturnValues.push([{ id: "provider-1", status: "pending_review" }]);

    const result = await checkAllStepsCompleteAndTransition(
      "provider-1", "step-1", "test_trigger",
      { userId: "user-1", ipAddress: "127.0.0.1", userAgent: "test" },
      mockProvider,
    );

    expect(result).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending_review" }),
    );
  });

  it("broadcasts to admins on successful transition", async () => {
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "step-1", status: "complete" },
    ]);
    mockUpdateReturnValues.push([{ id: "provider-1", status: "pending_review" }]);

    await checkAllStepsCompleteAndTransition(
      "provider-1", "step-1", "test",
      undefined, mockProvider,
    );

    expect(broadcastToAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ type: "onboarding:ready_for_review" }),
    );
  });

  it("logs audit with trigger and context on successful transition", async () => {
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "step-1", status: "complete" },
    ]);
    mockUpdateReturnValues.push([{ id: "provider-1", status: "pending_review" }]);

    await checkAllStepsCompleteAndTransition(
      "provider-1", "step-1", "stripe_status_check",
      { userId: "user-1", ipAddress: "10.0.0.1", userAgent: "Mozilla" },
      mockProvider,
    );

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "onboarding.status_changed",
        userId: "user-1",
        details: expect.objectContaining({
          trigger: "stripe_status_check",
          reason: "all_steps_complete",
        }),
        ipAddress: "10.0.0.1",
        userAgent: "Mozilla",
      }),
    );
  });

  it("returns false on TOCTOU race (update returns empty)", async () => {
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "step-1", status: "complete" },
    ]);
    mockUpdateReturnValues.push([]); // Empty = TOCTOU race, another process already transitioned

    const result = await checkAllStepsCompleteAndTransition(
      "provider-1", "step-1", "test",
      undefined, mockProvider,
    );

    expect(result).toBe(false);
    expect(broadcastToAdmins).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("uses existingProvider instead of DB lookup when provided", async () => {
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "step-1", status: "complete" },
    ]);
    mockUpdateReturnValues.push([{ id: "provider-1" }]);

    await checkAllStepsCompleteAndTransition(
      "provider-1", "step-1", "test",
      undefined, mockProvider,
    );

    // Should NOT have called providers.findFirst since existingProvider was passed
    expect(db.query.providers.findFirst).not.toHaveBeenCalled();
  });

  it("falls back to DB lookup when existingProvider not provided", async () => {
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockProvider);
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "step-1", status: "complete" },
    ]);
    mockUpdateReturnValues.push([{ id: "provider-1" }]);

    await checkAllStepsCompleteAndTransition(
      "provider-1", "step-1", "test",
    );

    expect(db.query.providers.findFirst).toHaveBeenCalled();
  });
});

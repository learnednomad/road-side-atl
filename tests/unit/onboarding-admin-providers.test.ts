import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test.
// ---------------------------------------------------------------------------

vi.mock("@/db", () => {
  const mockReturning = vi.fn();
  const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

  const mockInsertReturning = vi.fn();
  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  const mockTransaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    };
    return cb(tx);
  });

  return {
    db: {
      query: {
        providers: { findFirst: vi.fn(), findMany: vi.fn() },
        onboardingSteps: { findFirst: vi.fn(), findMany: vi.fn() },
        users: { findFirst: vi.fn() },
        providerInviteTokens: { findFirst: vi.fn() },
        providerDocuments: { findFirst: vi.fn(), findMany: vi.fn() },
      },
      insert: mockInsert,
      update: mockUpdate,
      transaction: mockTransaction,
    },
  };
});

vi.mock("@/db/schema", () => ({
  providers: { id: "id", email: "email", status: "status" },
  providerPayouts: { providerId: "providerId", amount: "amount", createdAt: "createdAt", status: "status", payoutType: "payoutType" },
  bookings: { id: "id" },
  providerInviteTokens: { identifier: "identifier", token: "token", providerId: "providerId", status: "status", createdAt: "createdAt", acceptedAt: "acceptedAt" },
}));

vi.mock("@/db/schema/auth", () => ({
  providerInviteTokens: { identifier: "identifier", token: "token", providerId: "providerId", status: "status", createdAt: "createdAt", acceptedAt: "acceptedAt" },
}));

vi.mock("@/db/schema/users", () => ({
  users: { id: "id", email: "email", taxId: "taxId" },
}));

vi.mock("@/db/schema/providers", () => ({
  providers: { id: "id", email: "email", status: "status" },
}));

vi.mock("@/db/schema/onboarding-steps", () => ({
  onboardingSteps: { id: "id", stepType: "stepType", status: "status", providerId: "providerId" },
}));

vi.mock("@/db/schema/provider-invites", () => ({
  providerInviteTokens: { identifier: "identifier", token: "token", providerId: "providerId", status: "status", createdAt: "createdAt", acceptedAt: "acceptedAt" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ _op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ _op: "and", args })),
  or: vi.fn((...args: unknown[]) => ({ _op: "or", args })),
  desc: vi.fn((...args: unknown[]) => ({ _op: "desc", args })),
  asc: vi.fn((...args: unknown[]) => ({ _op: "asc", args })),
  sql: vi.fn(),
  count: vi.fn(),
  inArray: vi.fn(),
  isNull: vi.fn(),
  ilike: vi.fn((...args: unknown[]) => ({ _op: "ilike", args })),
}));

vi.mock("@/server/api/middleware/auth", () => ({
  requireAdmin: vi.fn((c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
    c.set("user", { id: "admin-1", role: "admin", name: "Admin User", email: "admin@example.com" });
    return next();
  }),
}));

vi.mock("@/server/api/middleware/rate-limit", () => ({
  rateLimitStrict: vi.fn((_c: unknown, next: () => Promise<void>) => next()),
}));

vi.mock("@/lib/validators", () => {
  const makeSafeParse = (requiredKeys: string[]) => ({
    safeParse: (data: Record<string, unknown>) => {
      for (const key of requiredKeys) {
        if (data[key] === undefined || data[key] === null || data[key] === "") {
          return { success: false, error: { issues: [{ path: [key], message: `${key} required` }] } };
        }
      }
      return { success: true, data };
    },
  });
  return {
    createProviderSchema: makeSafeParse(["name", "email"]),
    updateProviderSchema: { safeParse: (data: unknown) => ({ success: true, data }) },
    onboardingInviteSchema: makeSafeParse(["email", "name"]),
    adminRejectProviderSchema: makeSafeParse(["reason"]),
    adminSuspendProviderSchema: makeSafeParse(["reason"]),
    adminReviewStepSchema: {
      safeParse: (data: Record<string, unknown>) => {
        if (!data.status || !["complete", "rejected"].includes(data.status as string)) {
          return { success: false, error: { issues: [{ path: ["status"], message: "Invalid status" }] } };
        }
        if (data.status === "rejected" && (!data.rejectionReason || data.rejectionReason === "")) {
          return { success: false, error: { issues: [{ path: ["rejectionReason"], message: "Rejection reason required" }] } };
        }
        return { success: true, data };
      },
    },
  };
});

vi.mock("@/lib/constants", () => ({
  ONBOARDING_INVITE_EXPIRY_HOURS: 72,
  PROVIDER_STATUSES: ["active", "inactive", "pending", "resubmission_requested", "applied", "onboarding", "pending_review", "rejected", "suspended"],
  IRS_1099_THRESHOLD_CENTS: 60000,
}));

vi.mock("@/lib/geocoding", () => ({
  geocodeAddress: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/auth/provider-invite", () => ({
  createProviderInviteToken: vi.fn().mockResolvedValue("mock-token"),
  sendProviderInviteEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/api/lib/audit-logger", () => ({
  logAudit: vi.fn(),
  getRequestInfo: vi.fn().mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "test" }),
}));

vi.mock("@/server/api/lib/encryption", () => ({
  encrypt: vi.fn((v: string) => `enc_${v}`),
  decrypt: vi.fn((v: string) => v.replace("enc_", "")),
}));

vi.mock("@/lib/csv", () => ({
  generateCSV: vi.fn().mockReturnValue("csv-data"),
}));

vi.mock("@/server/websocket/broadcast", () => ({
  broadcastToUser: vi.fn(),
  broadcastToAdmins: vi.fn(),
}));

vi.mock("@/server/api/lib/onboarding-state-machine", async () => {
  const actual = await vi.importActual("@/server/api/lib/onboarding-state-machine");
  return actual;
});

vi.mock("@/lib/notifications", () => ({
  notifyDocumentReviewed: vi.fn().mockResolvedValue(undefined),
  notifyAdjudicationResult: vi.fn().mockResolvedValue(undefined),
  notifyProviderRejected: vi.fn().mockResolvedValue(undefined),
  notifyAdminProviderReadyForReview: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/s3", () => ({
  getPresignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/download?signed=true"),
}));

vi.mock("@/db/schema/provider-documents", () => ({
  providerDocuments: { id: "id", providerId: "providerId", onboardingStepId: "onboardingStepId", status: "status", createdAt: "createdAt" },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { db } from "@/db";
import app from "@/server/api/routes/admin-providers";
import { logAudit } from "@/server/api/lib/audit-logger";
import { broadcastToUser } from "@/server/websocket/broadcast";
import { sendEmail } from "@/lib/notifications/email";

const mockProvidersFindFirst = db.query.providers.findFirst as ReturnType<typeof vi.fn>;
const mockStepsFindFirst = (db.query as unknown as { onboardingSteps: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> } }).onboardingSteps.findFirst;
const mockStepsFindMany = (db.query as unknown as { onboardingSteps: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> } }).onboardingSteps.findMany;
const mockDbUpdate = db.update as ReturnType<typeof vi.fn>;
const mockTransaction = db.transaction as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;
const mockBroadcastToUser = broadcastToUser as ReturnType<typeof vi.fn>;
const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePost(path: string, body?: Record<string, unknown>) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makePatch(path: string, body: Record<string, unknown>) {
  return new Request(`http://localhost${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setupUpdateReturning(returnValue: unknown[]) {
  const mockReturning = vi.fn().mockResolvedValue(returnValue);
  const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  mockDbUpdate.mockReturnValue({ set: mockSet });
  return { mockSet, mockWhere, mockReturning };
}

// ---------------------------------------------------------------------------
// Tests — POST /:id/activate
// ---------------------------------------------------------------------------

describe("POST /:id/activate — Activate Provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("activates provider in pending_review status", async () => {
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1", name: "Test Provider", email: "test@example.com",
      status: "pending_review", userId: "u1",
    });
    setupUpdateReturning([{
      id: "p1", name: "Test Provider", status: "active", activatedAt: new Date(),
    }]);

    const res = await app.fetch(makePost("/p1/activate"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("active");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "onboarding.activated" }),
    );
    expect(mockBroadcastToUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ type: "onboarding:activated" }),
    );
    expect(mockSendEmail).toHaveBeenCalled();
  });

  it("returns 400 for invalid transition (not pending_review)", async () => {
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1", status: "onboarding", userId: "u1",
    });

    const res = await app.fetch(makePost("/p1/activate"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid transition");
  });

  it("returns 404 when provider not found", async () => {
    mockProvidersFindFirst.mockResolvedValue(null);

    const res = await app.fetch(makePost("/p1/activate"));
    expect(res.status).toBe(404);
  });

  it("returns 409 when status changed between check and update (TOCTOU)", async () => {
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1", status: "pending_review", userId: "u1",
    });
    setupUpdateReturning([]); // Empty = TOCTOU race

    const res = await app.fetch(makePost("/p1/activate"));
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// Tests — POST /:id/reject
// ---------------------------------------------------------------------------

describe("POST /:id/reject — Reject Provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects provider with reason", async () => {
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1", status: "pending_review", userId: "u1",
    });
    setupUpdateReturning([{
      id: "p1", status: "rejected", suspendedReason: "Incomplete docs",
    }]);

    const res = await app.fetch(makePost("/p1/reject", { reason: "Incomplete docs" }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("rejected");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "onboarding.rejected",
        details: expect.objectContaining({ reason: "Incomplete docs" }),
      }),
    );
  });

  it("returns 400 when reason is missing", async () => {
    const res = await app.fetch(makePost("/p1/reject", {}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid transition", async () => {
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1", status: "active", userId: "u1",
    });

    const res = await app.fetch(makePost("/p1/reject", { reason: "Test" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid transition");
  });
});

// ---------------------------------------------------------------------------
// Tests — POST /:id/suspend
// ---------------------------------------------------------------------------

describe("POST /:id/suspend — Suspend Provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("suspends active provider with reason", async () => {
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1", status: "active", userId: "u1",
    });
    setupUpdateReturning([{
      id: "p1", status: "suspended", suspendedAt: new Date(), suspendedReason: "Policy violation",
    }]);

    const res = await app.fetch(makePost("/p1/suspend", { reason: "Policy violation" }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("suspended");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "onboarding.suspended",
        details: expect.objectContaining({ reason: "Policy violation" }),
      }),
    );
  });

  it("returns 400 for invalid transition (not active)", async () => {
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1", status: "onboarding", userId: "u1",
    });

    const res = await app.fetch(makePost("/p1/suspend", { reason: "Test" }));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests — POST /:id/reinstate
// ---------------------------------------------------------------------------

describe("POST /:id/reinstate — Reinstate Provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reinstates suspended provider and resets rejected steps", async () => {
    mockProvidersFindFirst
      .mockResolvedValueOnce({
        id: "p1", status: "suspended", userId: "u1",
      })
      .mockResolvedValueOnce({
        id: "p1", status: "onboarding", userId: "u1", suspendedAt: null, suspendedReason: null,
      });

    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
      };
      return cb(tx);
    });

    const res = await app.fetch(makePost("/p1/reinstate"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("onboarding");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "onboarding.status_changed",
        details: expect.objectContaining({
          previousStatus: "suspended",
          newStatus: "onboarding",
        }),
      }),
    );
  });

  it("returns 400 for invalid transition (not suspended)", async () => {
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1", status: "active", userId: "u1",
    });

    const res = await app.fetch(makePost("/p1/reinstate"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid transition");
  });
});

// ---------------------------------------------------------------------------
// Tests — PATCH /:id/steps/:stepId
// ---------------------------------------------------------------------------

describe("PATCH /:id/steps/:stepId — Admin Step Review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approves step in pending_review status", async () => {
    mockStepsFindFirst.mockResolvedValue({
      id: "s1", stepType: "insurance", status: "pending_review", providerId: "p1",
    });
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1", status: "onboarding", userId: "u1",
    });
    mockStepsFindMany.mockResolvedValue([
      { id: "s1", status: "pending_review" },
      { id: "s2", status: "complete" },
    ]);
    setupUpdateReturning([{
      id: "s1", status: "complete", completedAt: new Date(), reviewedBy: "admin-1",
    }]);

    const res = await app.fetch(makePatch("/p1/steps/s1", { status: "complete" }));
    expect(res.status).toBe(200);

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "onboarding.step_completed" }),
    );
    expect(mockBroadcastToUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ type: "onboarding:step_updated" }),
    );
  });

  it("rejects step with rejection reason", async () => {
    mockStepsFindFirst.mockResolvedValue({
      id: "s1", stepType: "insurance", status: "pending_review", providerId: "p1",
    });
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1", status: "onboarding", userId: "u1",
    });
    setupUpdateReturning([{
      id: "s1", status: "rejected", rejectionReason: "Expired policy",
    }]);

    const res = await app.fetch(
      makePatch("/p1/steps/s1", { status: "rejected", rejectionReason: "Expired policy" }),
    );
    expect(res.status).toBe(200);

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "onboarding.step_rejected",
        details: expect.objectContaining({ reason: "Expired policy" }),
      }),
    );
  });

  it("returns 400 when rejecting without reason", async () => {
    const res = await app.fetch(
      makePatch("/p1/steps/s1", { status: "rejected" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid step transition", async () => {
    mockStepsFindFirst.mockResolvedValue({
      id: "s1", stepType: "insurance", status: "pending", providerId: "p1",
    });

    const res = await app.fetch(makePatch("/p1/steps/s1", { status: "complete" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid step transition");
  });

  it("returns 404 when step not found or not belonging to provider", async () => {
    mockStepsFindFirst.mockResolvedValue(null);

    const res = await app.fetch(makePatch("/p1/steps/nonexistent", { status: "complete" }));
    expect(res.status).toBe(404);
  });

  it("auto-transitions provider to pending_review when all steps complete", async () => {
    mockStepsFindFirst.mockResolvedValue({
      id: "s1", stepType: "insurance", status: "pending_review", providerId: "p1",
    });
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1", status: "onboarding", userId: "u1",
    });
    // All other steps already complete
    mockStepsFindMany.mockResolvedValue([
      { id: "s1", status: "pending_review" }, // This one is being approved
      { id: "s2", status: "complete" },
      { id: "s3", status: "complete" },
      { id: "s4", status: "complete" },
      { id: "s5", status: "complete" },
    ]);

    // First update returns the step
    const mockReturning = vi.fn()
      .mockResolvedValueOnce([{
        id: "s1", status: "complete", completedAt: new Date(),
      }])
      .mockResolvedValueOnce([{
        id: "p1", status: "pending_review",
      }]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    mockDbUpdate.mockReturnValue({ set: mockSet });

    const res = await app.fetch(makePatch("/p1/steps/s1", { status: "complete" }));
    expect(res.status).toBe(200);

    // Should have logged the auto-transition
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "onboarding.status_changed",
        details: expect.objectContaining({
          previousStatus: "onboarding",
          newStatus: "pending_review",
          trigger: "all_steps_complete",
        }),
      }),
    );
  });
});

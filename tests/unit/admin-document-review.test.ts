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

vi.mock("@/db/schema/provider-documents", () => ({
  providerDocuments: { id: "id", providerId: "providerId", onboardingStepId: "onboardingStepId", status: "status", createdAt: "createdAt" },
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
    adminDocumentReviewSchema: {
      safeParse: (data: Record<string, unknown>) => {
        if (!data.status || !["approved", "rejected"].includes(data.status as string)) {
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
  PROVIDER_STATUSES: ["active", "inactive", "pending", "applied", "onboarding", "pending_review", "rejected", "suspended"],
  IRS_1099_THRESHOLD_CENTS: 60000,
  PRESIGNED_DOWNLOAD_EXPIRY_ADMIN: 600,
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

vi.mock("@/lib/notifications", () => ({
  notifyDocumentReviewed: vi.fn().mockResolvedValue(undefined),
  notifyAdjudicationResult: vi.fn().mockResolvedValue(undefined),
  notifyProviderRejected: vi.fn().mockResolvedValue(undefined),
  notifyAdminProviderReadyForReview: vi.fn().mockResolvedValue(undefined),
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

vi.mock("@/lib/s3", () => ({
  getPresignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/download?signed=true"),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { db } from "@/db";
import app from "@/server/api/routes/admin-providers";
import { logAudit } from "@/server/api/lib/audit-logger";
import { broadcastToUser } from "@/server/websocket/broadcast";
import { notifyDocumentReviewed } from "@/lib/notifications";
import { getPresignedUrl } from "@/lib/s3";

const mockProvidersFindFirst = db.query.providers.findFirst as ReturnType<typeof vi.fn>;
const mockStepsFindFirst = (db.query as unknown as { onboardingSteps: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> } }).onboardingSteps.findFirst;
const mockStepsFindMany = (db.query as unknown as { onboardingSteps: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> } }).onboardingSteps.findMany;
const mockDocsFindFirst = (db.query as unknown as { providerDocuments: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> } }).providerDocuments.findFirst;
const mockDocsFindMany = (db.query as unknown as { providerDocuments: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> } }).providerDocuments.findMany;
const mockDbUpdate = db.update as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;
const mockBroadcastToUser = broadcastToUser as ReturnType<typeof vi.fn>;
const mockNotifyDocumentReviewed = notifyDocumentReviewed as ReturnType<typeof vi.fn>;
const mockGetPresignedUrl = getPresignedUrl as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGet(path: string) {
  return new Request(`http://localhost${path}`, { method: "GET" });
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
// Tests — GET /:id/documents (Admin)
// ---------------------------------------------------------------------------

describe("GET /:id/documents — Admin List Provider Documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns documents grouped by type with presigned URLs", async () => {
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1", name: "Test Provider", status: "onboarding",
    });
    mockDocsFindMany.mockResolvedValue([
      { id: "doc-1", documentType: "insurance", s3Key: "key1", status: "pending_review", createdAt: new Date() },
      { id: "doc-2", documentType: "insurance", s3Key: "key2", status: "approved", createdAt: new Date() },
      { id: "doc-3", documentType: "certification", s3Key: "key3", status: "rejected", createdAt: new Date() },
    ]);

    const res = await app.fetch(makeGet("/p1/documents"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.documents.insurance).toHaveLength(2);
    expect(json.documents.certification).toHaveLength(1);
    // Each doc should have a downloadUrl
    expect(json.documents.insurance[0].downloadUrl).toBe("https://s3.example.com/download?signed=true");
    expect(mockGetPresignedUrl).toHaveBeenCalledTimes(3);
    expect(mockGetPresignedUrl).toHaveBeenCalledWith("key1", 600);
  });

  it("returns 404 when provider not found", async () => {
    mockProvidersFindFirst.mockResolvedValue(null);

    const res = await app.fetch(makeGet("/p999/documents"));
    expect(res.status).toBe(404);
  });

  it("returns empty groups when no documents", async () => {
    mockProvidersFindFirst.mockResolvedValue({ id: "p1" });
    mockDocsFindMany.mockResolvedValue([]);

    const res = await app.fetch(makeGet("/p1/documents"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.documents).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Tests — PATCH /:id/documents/:documentId (Admin)
// ---------------------------------------------------------------------------

describe("PATCH /:id/documents/:documentId — Admin Document Review", () => {
  const mockDoc = {
    id: "doc-1",
    providerId: "p1",
    onboardingStepId: "step-1",
    documentType: "insurance",
    status: "pending_review",
    s3Key: "onboarding/p1/insurance/12345.jpg",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDocsFindFirst.mockResolvedValue(mockDoc);
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1", name: "Test Provider", status: "onboarding", userId: "u1",
    });
  });

  it("approves document and sets reviewedBy/reviewedAt", async () => {
    setupUpdateReturning([{
      ...mockDoc,
      status: "approved",
      reviewedBy: "admin-1",
      reviewedAt: new Date(),
    }]);
    // After approval, check auto-complete: return docs for this step
    mockDocsFindMany.mockResolvedValue([
      { ...mockDoc, status: "approved" },
    ]);
    // Step lookup for auto-complete
    mockStepsFindFirst.mockResolvedValue({
      id: "step-1", stepType: "insurance", status: "in_progress", providerId: "p1",
    });
    // All steps for provider auto-transition check
    mockStepsFindMany.mockResolvedValue([
      { id: "step-1", status: "in_progress" },
      { id: "step-2", status: "complete" },
    ]);

    const res = await app.fetch(makePatch("/p1/documents/doc-1", { status: "approved" }));
    expect(res.status).toBe(200);

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "document.approved",
        resourceType: "provider_document",
        resourceId: "doc-1",
      }),
    );

    expect(mockBroadcastToUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        type: "onboarding:document_reviewed",
        data: expect.objectContaining({
          providerId: "p1",
          status: "approved",
        }),
      }),
    );

    expect(mockNotifyDocumentReviewed).toHaveBeenCalled();
  });

  it("rejects document with reason", async () => {
    setupUpdateReturning([{
      ...mockDoc,
      status: "rejected",
      rejectionReason: "Expired policy",
      reviewedBy: "admin-1",
    }]);

    const res = await app.fetch(makePatch("/p1/documents/doc-1", {
      status: "rejected",
      rejectionReason: "Expired policy",
    }));
    expect(res.status).toBe(200);

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "document.rejected",
        details: expect.objectContaining({
          reason: "Expired policy",
        }),
      }),
    );
  });

  it("returns 400 when rejecting without reason", async () => {
    const res = await app.fetch(makePatch("/p1/documents/doc-1", { status: "rejected" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when document not found", async () => {
    mockDocsFindFirst.mockResolvedValue(null);

    const res = await app.fetch(makePatch("/p1/documents/doc-999", { status: "approved" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when document is not pending_review", async () => {
    mockDocsFindFirst.mockResolvedValue({
      ...mockDoc,
      status: "approved",
    });

    const res = await app.fetch(makePatch("/p1/documents/doc-1", { status: "approved" }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain("Cannot review document");
  });

  it("returns 400 for invalid status value", async () => {
    const res = await app.fetch(makePatch("/p1/documents/doc-1", { status: "pending_review" }));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests — Auto-complete logic
// ---------------------------------------------------------------------------

describe("Auto-complete — Document Approval Cascading", () => {
  const mockDoc = {
    id: "doc-1",
    providerId: "p1",
    onboardingStepId: "step-1",
    documentType: "insurance",
    status: "pending_review",
    s3Key: "onboarding/p1/insurance/12345.jpg",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDocsFindFirst.mockResolvedValue(mockDoc);
  });

  it("auto-completes step when last document approved", async () => {
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1", name: "Test Provider", status: "onboarding", userId: "u1",
    });

    // Setup for the document update
    const firstUpdateReturning = vi.fn().mockResolvedValue([{
      ...mockDoc, status: "approved", reviewedBy: "admin-1",
    }]);
    // Second update for step completion, third for provider transition — just resolve
    const subsequentReturning = vi.fn().mockResolvedValue([{}]);
    let updateCallCount = 0;
    mockDbUpdate.mockImplementation(() => {
      updateCallCount++;
      if (updateCallCount === 1) {
        return {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({ returning: firstUpdateReturning }),
          }),
        };
      }
      return {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: subsequentReturning }),
        }),
      };
    });

    // All docs for the step are approved (the current doc is being approved)
    mockDocsFindMany.mockResolvedValueOnce([
      { id: "doc-1", status: "pending_review", onboardingStepId: "step-1" },
      { id: "doc-2", status: "approved", onboardingStepId: "step-1" },
    ]);

    // Step for auto-complete
    mockStepsFindFirst.mockResolvedValue({
      id: "step-1", stepType: "insurance", status: "in_progress", providerId: "p1",
    });

    // All steps for provider auto-transition check — not all complete
    mockStepsFindMany.mockResolvedValue([
      { id: "step-1", status: "in_progress" }, // will be completed
      { id: "step-2", status: "pending" }, // not complete
    ]);

    const res = await app.fetch(makePatch("/p1/documents/doc-1", { status: "approved" }));
    expect(res.status).toBe(200);

    // Should log step completion
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "onboarding.step_completed",
        details: expect.objectContaining({
          trigger: "all_documents_approved",
        }),
      }),
    );
  });

  it("auto-transitions provider to pending_review when all steps complete", async () => {
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1", name: "Test Provider", status: "onboarding", userId: "u1",
    });

    let updateCallCount = 0;
    mockDbUpdate.mockImplementation(() => {
      updateCallCount++;
      return {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: updateCallCount === 1 ? "doc-1" : "step-1", status: "approved" }]),
          }),
        }),
      };
    });

    // Only doc for step, which is the one being approved
    mockDocsFindMany.mockResolvedValueOnce([
      { id: "doc-1", status: "pending_review", onboardingStepId: "step-1" },
    ]);

    mockStepsFindFirst.mockResolvedValue({
      id: "step-1", stepType: "insurance", status: "in_progress", providerId: "p1",
    });

    // All steps complete (including the one being completed now)
    mockStepsFindMany.mockResolvedValue([
      { id: "step-1", status: "in_progress" },
      { id: "step-2", status: "complete" },
      { id: "step-3", status: "complete" },
      { id: "step-4", status: "complete" },
      { id: "step-5", status: "complete" },
    ]);

    const res = await app.fetch(makePatch("/p1/documents/doc-1", { status: "approved" }));
    expect(res.status).toBe(200);

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

  it("does NOT auto-complete step if not all docs approved", async () => {
    mockProvidersFindFirst.mockResolvedValue({
      id: "p1", name: "Test Provider", status: "onboarding", userId: "u1",
    });

    setupUpdateReturning([{ ...mockDoc, status: "approved" }]);

    // Some docs still pending
    mockDocsFindMany.mockResolvedValue([
      { id: "doc-1", status: "pending_review", onboardingStepId: "step-1" },
      { id: "doc-2", status: "pending_review", onboardingStepId: "step-1" },
    ]);

    const res = await app.fetch(makePatch("/p1/documents/doc-1", { status: "approved" }));
    expect(res.status).toBe(200);

    // Should NOT log step completion
    const stepCompletedCalls = mockLogAudit.mock.calls.filter(
      (call) => call[0]?.action === "onboarding.step_completed"
    );
    expect(stepCompletedCalls).toHaveLength(0);
  });
});

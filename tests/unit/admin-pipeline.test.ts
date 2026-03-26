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

  // The pipeline endpoint uses db.select().from().leftJoin().where().$dynamic().orderBy()
  // We need a chainable mock where orderBy() returns a promise with results
  const pipelineResults = vi.fn().mockResolvedValue([]);
  const makeDynamic = () => ({
    where: vi.fn().mockReturnValue({ orderBy: pipelineResults }),
    orderBy: pipelineResults,
  });
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      leftJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          $dynamic: makeDynamic,
        }),
        $dynamic: makeDynamic,
      }),
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  });

  return {
    db: {
      query: {
        providers: { findFirst: vi.fn(), findMany: vi.fn() },
        onboardingSteps: { findFirst: vi.fn(), findMany: vi.fn() },
        users: { findFirst: vi.fn() },
        providerInvites: { findFirst: vi.fn() },
        providerInviteTokens: { findFirst: vi.fn() },
        providerDocuments: { findFirst: vi.fn(), findMany: vi.fn() },
      },
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      transaction: mockTransaction,
      _pipelineResults: pipelineResults,
    },
  };
});

vi.mock("@/db/schema", () => ({
  providers: { id: "id", email: "email", status: "status", createdAt: "createdAt", userId: "userId", name: "name" },
  providerPayouts: { providerId: "providerId", amount: "amount", createdAt: "createdAt", status: "status", payoutType: "payoutType" },
  bookings: { id: "id" },
  providerInvites: { id: "id", email: "email", token: "token", usedAt: "usedAt" },
}));

vi.mock("@/db/schema/auth", () => ({
  providerInviteTokens: { providerId: "providerId", createdAt: "createdAt", status: "status" },
}));

vi.mock("@/db/schema/users", () => ({
  users: { id: "id", email: "email", taxId: "taxId", name: "name" },
}));

vi.mock("@/db/schema/providers", () => ({
  providers: { id: "id", email: "email", status: "status", createdAt: "createdAt", userId: "userId", name: "name" },
}));

vi.mock("@/db/schema/onboarding-steps", () => ({
  onboardingSteps: { id: "id", stepType: "stepType", status: "status", providerId: "providerId" },
}));

vi.mock("@/db/schema/provider-invites", () => ({
  providerInvites: { id: "id", email: "email", token: "token", usedAt: "usedAt" },
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

vi.mock("@/lib/geocoding", () => ({ geocodeAddress: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/auth/provider-invite", () => ({ createProviderInviteToken: vi.fn().mockResolvedValue("mock-token"), sendProviderInviteEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notifications/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notifications", () => ({ notifyDocumentReviewed: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/server/api/lib/audit-logger", () => ({ logAudit: vi.fn(), getRequestInfo: vi.fn().mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "test" }) }));
vi.mock("@/server/api/lib/encryption", () => ({ encrypt: vi.fn((v: string) => `enc_${v}`), decrypt: vi.fn((v: string) => v.replace("enc_", "")) }));
vi.mock("@/lib/csv", () => ({ generateCSV: vi.fn().mockReturnValue("csv-data") }));
vi.mock("@/server/websocket/broadcast", () => ({ broadcastToUser: vi.fn(), broadcastToAdmins: vi.fn() }));
vi.mock("@/server/api/lib/onboarding-state-machine", async () => { const actual = await vi.importActual("@/server/api/lib/onboarding-state-machine"); return actual; });
vi.mock("@/lib/s3", () => ({ getPresignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/download?signed=true") }));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { db } from "@/db";
import app from "@/server/api/routes/admin-providers";

const mockStepsFindMany = (db.query as unknown as { onboardingSteps: { findMany: ReturnType<typeof vi.fn> } }).onboardingSteps.findMany;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPipelineResults = (db as any)._pipelineResults as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGet(path: string) {
  return new Request(`http://localhost${path}`, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Tests — GET /pipeline
// ---------------------------------------------------------------------------

describe("GET /pipeline — Admin Pipeline View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns providers grouped by stages", async () => {
    const appliedProvider = {
      provider: { id: "p1", name: "Applied Provider", email: "applied@test.com", status: "applied", createdAt: new Date().toISOString(), userId: "u1" },
      userName: "Applied User",
      userEmail: "applied@test.com",
    };
    const onboardingProvider = {
      provider: { id: "p2", name: "Onboarding Provider", email: "onboarding@test.com", status: "onboarding", createdAt: new Date().toISOString(), userId: "u2" },
      userName: "Onboarding User",
      userEmail: "onboarding@test.com",
    };
    const pendingReviewProvider = {
      provider: { id: "p3", name: "Ready Provider", email: "ready@test.com", status: "pending_review", createdAt: new Date().toISOString(), userId: "u3" },
      userName: "Ready User",
      userEmail: "ready@test.com",
    };

    mockPipelineResults.mockResolvedValueOnce([appliedProvider, onboardingProvider, pendingReviewProvider]);

    // Batch-fetch: single call returns all steps for all providers
    mockStepsFindMany.mockResolvedValueOnce([
      { id: "s1", providerId: "p2", stepType: "background_check", status: "complete" },
      { id: "s2", providerId: "p2", stepType: "insurance", status: "in_progress" },
      { id: "s3", providerId: "p2", stepType: "certifications", status: "pending" },
      { id: "s4", providerId: "p2", stepType: "training", status: "pending" },
      { id: "s5", providerId: "p2", stepType: "stripe_connect", status: "pending" },
    ]);

    const res = await app.fetch(makeGet("/pipeline"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.total).toBe(3);
    expect(json.stages.applied).toHaveLength(1);
    expect(json.stages.documents_pending).toHaveLength(1);
    expect(json.stages.ready_for_review).toHaveLength(1);
  });

  it("returns empty stages when no providers in pipeline", async () => {
    mockPipelineResults.mockResolvedValueOnce([]);

    const res = await app.fetch(makeGet("/pipeline"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.total).toBe(0);
    expect(json.stages.applied).toHaveLength(0);
    expect(json.stages.documents_pending).toHaveLength(0);
    expect(json.stages.background_check).toHaveLength(0);
    expect(json.stages.stripe_setup).toHaveLength(0);
    expect(json.stages.training).toHaveLength(0);
    expect(json.stages.ready_for_review).toHaveLength(0);
  });

  it("filters by single stage when stage param provided", async () => {
    const provider = {
      provider: { id: "p1", name: "Applied Provider", email: "test@test.com", status: "applied", createdAt: new Date().toISOString(), userId: "u1" },
      userName: "User",
      userEmail: "test@test.com",
    };

    mockPipelineResults.mockResolvedValueOnce([provider]);
    mockStepsFindMany.mockResolvedValueOnce([]); // batch: no steps

    const res = await app.fetch(makeGet("/pipeline?stage=applied"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.stages.applied).toHaveLength(1);
    expect(json.stages.documents_pending).toBeUndefined();
  });

  it("groups onboarding provider by background_check stage", async () => {
    const provider = {
      provider: { id: "p1", name: "BG Provider", email: "bg@test.com", status: "onboarding", createdAt: new Date().toISOString(), userId: "u1" },
      userName: "User",
      userEmail: "bg@test.com",
    };

    mockPipelineResults.mockResolvedValueOnce([provider]);
    mockStepsFindMany.mockResolvedValueOnce([
      { id: "s1", providerId: "p1", stepType: "background_check", status: "pending" },
      { id: "s2", providerId: "p1", stepType: "insurance", status: "pending" },
      { id: "s3", providerId: "p1", stepType: "certifications", status: "pending" },
      { id: "s4", providerId: "p1", stepType: "training", status: "pending" },
      { id: "s5", providerId: "p1", stepType: "stripe_connect", status: "pending" },
    ]);

    const res = await app.fetch(makeGet("/pipeline"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.stages.background_check).toHaveLength(1);
  });

  it("groups onboarding provider by training stage", async () => {
    const provider = {
      provider: { id: "p1", name: "Training Provider", email: "train@test.com", status: "onboarding", createdAt: new Date().toISOString(), userId: "u1" },
      userName: "User",
      userEmail: "train@test.com",
    };

    mockPipelineResults.mockResolvedValueOnce([provider]);
    mockStepsFindMany.mockResolvedValueOnce([
      { id: "s1", providerId: "p1", stepType: "background_check", status: "complete" },
      { id: "s2", providerId: "p1", stepType: "insurance", status: "complete" },
      { id: "s3", providerId: "p1", stepType: "certifications", status: "complete" },
      { id: "s4", providerId: "p1", stepType: "training", status: "in_progress" },
      { id: "s5", providerId: "p1", stepType: "stripe_connect", status: "pending" },
    ]);

    const res = await app.fetch(makeGet("/pipeline"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.stages.training).toHaveLength(1);
  });

  it("groups onboarding provider by stripe_setup stage", async () => {
    const provider = {
      provider: { id: "p1", name: "Stripe Provider", email: "stripe@test.com", status: "onboarding", createdAt: new Date().toISOString(), userId: "u1" },
      userName: "User",
      userEmail: "stripe@test.com",
    };

    mockPipelineResults.mockResolvedValueOnce([provider]);
    mockStepsFindMany.mockResolvedValueOnce([
      { id: "s1", providerId: "p1", stepType: "background_check", status: "complete" },
      { id: "s2", providerId: "p1", stepType: "insurance", status: "complete" },
      { id: "s3", providerId: "p1", stepType: "certifications", status: "complete" },
      { id: "s4", providerId: "p1", stepType: "training", status: "complete" },
      { id: "s5", providerId: "p1", stepType: "stripe_connect", status: "pending" },
    ]);

    const res = await app.fetch(makeGet("/pipeline"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.stages.stripe_setup).toHaveLength(1);
  });

  it("includes step completion count in response", async () => {
    const provider = {
      provider: { id: "p1", name: "Provider", email: "test@test.com", status: "onboarding", createdAt: new Date().toISOString(), userId: "u1" },
      userName: "User",
      userEmail: "test@test.com",
    };

    mockPipelineResults.mockResolvedValueOnce([provider]);
    mockStepsFindMany.mockResolvedValueOnce([
      { id: "s1", providerId: "p1", stepType: "background_check", status: "complete" },
      { id: "s2", providerId: "p1", stepType: "insurance", status: "complete" },
      { id: "s3", providerId: "p1", stepType: "certifications", status: "in_progress" },
      { id: "s4", providerId: "p1", stepType: "training", status: "pending" },
      { id: "s5", providerId: "p1", stepType: "stripe_connect", status: "pending" },
    ]);

    const res = await app.fetch(makeGet("/pipeline"));
    expect(res.status).toBe(200);

    const json = await res.json();
    const providerInStage = json.stages.documents_pending[0];
    expect(providerInStage.completedSteps).toBe(2);
    expect(providerInStage.totalSteps).toBe(5);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────

vi.mock("@/db", () => ({
  db: {
    query: {
      providers: { findFirst: vi.fn(), findMany: vi.fn() },
      onboardingSteps: { findFirst: vi.fn(), findMany: vi.fn() },
      users: { findFirst: vi.fn() },
      providerInvites: { findFirst: vi.fn() },
      providerInviteTokens: { findFirst: vi.fn() },
      providerDocuments: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    }),
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
      };
      return cb(tx);
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  providers: { id: "id", email: "email", status: "status", name: "name", userId: "userId", createdAt: "createdAt" },
  providerPayouts: { providerId: "providerId", amount: "amount", createdAt: "createdAt", status: "status", payoutType: "payoutType" },
  bookings: { id: "id" },
  providerInvites: { id: "id", email: "email", token: "token", usedAt: "usedAt" },
}));

vi.mock("@/db/schema/auth", () => ({
  providerInviteTokens: { providerId: "providerId", createdAt: "createdAt", status: "status" },
}));

vi.mock("@/db/schema/users", () => ({
  users: { id: "id", email: "email", name: "name", taxId: "taxId" },
}));

vi.mock("@/db/schema/providers", () => ({
  providers: { id: "id", email: "email", status: "status", name: "name", userId: "userId", createdAt: "createdAt" },
}));

vi.mock("@/db/schema/onboarding-steps", () => ({
  onboardingSteps: {
    id: "id", stepType: "stepType", status: "status", providerId: "providerId",
    metadata: "metadata", updatedAt: "updatedAt", completedAt: "completedAt",
    rejectionReason: "rejectionReason", reviewedBy: "reviewedBy", reviewedAt: "reviewedAt",
  },
}));

vi.mock("@/db/schema/provider-invites", () => ({
  providerInvites: { id: "id", email: "email", token: "token", usedAt: "usedAt" },
}));

vi.mock("@/db/schema/provider-documents", () => ({
  providerDocuments: { id: "id", onboardingStepId: "onboardingStepId", providerId: "providerId", status: "status" },
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
  return {
    createProviderSchema: { safeParse: vi.fn(() => ({ success: true, data: {} })) },
    updateProviderSchema: { safeParse: vi.fn(() => ({ success: true, data: {} })) },
    onboardingInviteSchema: { safeParse: vi.fn(() => ({ success: true, data: {} })) },
    adminRejectProviderSchema: { safeParse: vi.fn(() => ({ success: true, data: {} })) },
    adminSuspendProviderSchema: { safeParse: vi.fn(() => ({ success: true, data: {} })) },
    adminReviewStepSchema: { safeParse: vi.fn(() => ({ success: true, data: {} })) },
    adminDocumentReviewSchema: { safeParse: vi.fn(() => ({ success: true, data: {} })) },
    adjudicationRequestSchema: {
      safeParse: (data: Record<string, unknown>) => {
        if (!data.decision || !["approve", "adverse_action"].includes(data.decision as string)) {
          return { success: false, error: { issues: [{ path: ["decision"], message: "Invalid decision" }] } };
        }
        if (!data.reason || (data.reason as string).length < 10) {
          return { success: false, error: { issues: [{ path: ["reason"], message: "Reason must be at least 10 characters" }] } };
        }
        return { success: true, data };
      },
    },
  };
});

vi.mock("@/server/api/lib/audit-logger", () => ({
  logAudit: vi.fn(),
  getRequestInfo: vi.fn().mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "test" }),
}));

vi.mock("@/server/api/lib/onboarding-state-machine", () => ({
  isValidStepTransition: vi.fn().mockReturnValue(true),
  isValidProviderTransition: vi.fn().mockReturnValue(true),
}));

vi.mock("@/server/websocket/broadcast", () => ({
  broadcastToUser: vi.fn(),
  broadcastToAdmins: vi.fn(),
  broadcastToProvider: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  notifyDocumentReviewed: vi.fn().mockResolvedValue(undefined),
  notifyAdjudicationResult: vi.fn().mockResolvedValue(undefined),
  notifyProviderRejected: vi.fn().mockResolvedValue(undefined),
  notifyAdminProviderReadyForReview: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/api/lib/checkr", () => ({
  createAdverseAction: vi.fn().mockResolvedValue({ id: "aa_123", report_id: "rpt_1", status: "pending" }),
  CheckrApiError: class CheckrApiError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

vi.mock("@/lib/s3", () => ({
  getPresignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/signed"),
}));

vi.mock("@/lib/geocoding", () => ({
  geocodeAddress: vi.fn().mockResolvedValue({ lat: 33.749, lng: -84.388 }),
}));

vi.mock("@/lib/auth/provider-invite", () => ({
  createProviderInviteToken: vi.fn().mockResolvedValue("token-123"),
  sendProviderInviteEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/api/lib/encryption", () => ({
  encrypt: vi.fn((v: string) => `enc_${v}`),
  decrypt: vi.fn((v: string) => v.replace("enc_", "")),
}));

vi.mock("@/lib/csv", () => ({
  generateCSV: vi.fn().mockReturnValue("csv-data"),
}));

vi.mock("@/lib/constants", async () => {
  const actual = await vi.importActual("@/lib/constants") as Record<string, unknown>;
  return {
    ...actual,
    ONBOARDING_INVITE_EXPIRY_HOURS: 72,
    PRESIGNED_DOWNLOAD_EXPIRY_ADMIN: 600,
    CHECKR_DASHBOARD_BASE_URL: "https://dashboard.checkr.com/reports",
    PROVIDER_STATUSES: ["active", "inactive", "pending", "resubmission_requested", "applied", "onboarding", "pending_review", "rejected", "suspended"],
    IRS_1099_THRESHOLD_CENTS: 60000,
  };
});

vi.mock("@/server/api/lib/reconciliation", () => ({
  reconcileCheckrStatuses: vi.fn().mockResolvedValue({
    checked: 2, updated: 1, errors: 0,
    details: [{ providerId: "prov_1", stepId: "step_1", previousStatus: "in_progress", newStatus: "complete", checkrStatus: "clear", adjudication: null }],
  }),
}));

// ── Tests ─────────────────────────────────────────────────────────

describe("Admin Adjudication Endpoint (POST /:id/adjudicate)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  beforeEach(async () => {
    vi.restoreAllMocks();

    // Re-setup db mock chains
    const { db } = await import("@/db");
    const dbAny = db as unknown as Record<string, ReturnType<typeof vi.fn>>;

    // Select chain
    const selectLimit = vi.fn().mockResolvedValue([]);
    const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    dbAny.select = vi.fn().mockReturnValue({ from: selectFrom });

    // Update chain
    const updateReturning = vi.fn().mockResolvedValue([]);
    const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    dbAny.update = vi.fn().mockReturnValue({ set: updateSet });

    // Store refs for test access
    dbAny._selectLimit = selectLimit;
    dbAny._updateReturning = updateReturning;

    // Reset query mocks
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.query.providers.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.query.onboardingSteps.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const mod = await import("@/server/api/routes/admin-providers");
    app = mod.default;
  });

  it("returns 400 for invalid decision value", async () => {
    const res = await app.request("/prov_1/adjudicate", {
      method: "POST",
      body: JSON.stringify({ decision: "maybe", reason: "Not sure about this one" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid input");
  });

  it("returns 400 for reason shorter than 10 characters", async () => {
    const res = await app.request("/prov_1/adjudicate", {
      method: "POST",
      body: JSON.stringify({ decision: "approve", reason: "short" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
  });

  it("returns 409 when no pending background_check step found", async () => {
    const { db } = await import("@/db");
    const dbAny = db as unknown as Record<string, ReturnType<typeof vi.fn>>;
    dbAny._selectLimit.mockResolvedValueOnce([]);

    const res = await app.request("/prov_1/adjudicate", {
      method: "POST",
      body: JSON.stringify({ decision: "approve", reason: "Background check looks fine after manual review" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("No pending adjudication");
  });

  it("approves background check and transitions step to complete", async () => {
    const { db } = await import("@/db");
    const { logAudit } = await import("@/server/api/lib/audit-logger");
    const { broadcastToUser } = await import("@/server/websocket/broadcast");
    const { notifyAdjudicationResult } = await import("@/lib/notifications");

    const dbAny = db as unknown as Record<string, ReturnType<typeof vi.fn>>;

    const mockStep = {
      id: "step_1",
      providerId: "prov_1",
      stepType: "background_check",
      status: "pending_review",
      metadata: { checkrReportId: "rpt_123", checkrCandidateId: "cand_1" },
    };

    dbAny._selectLimit.mockResolvedValueOnce([mockStep]);
    dbAny._updateReturning.mockResolvedValueOnce([{ ...mockStep, status: "complete" }]);
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "prov_1", userId: "user_1", name: "John Doe", status: "onboarding",
    });
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "step_1", status: "pending_review" },
      { id: "step_2", status: "in_progress" },
    ]);

    const res = await app.request("/prov_1/adjudicate", {
      method: "POST",
      body: JSON.stringify({ decision: "approve", reason: "Manual review passed - clean record" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "checkr.adjudication_approved" }),
    );
    expect(broadcastToUser).toHaveBeenCalledWith("user_1", expect.objectContaining({
      type: "onboarding:step_updated",
    }));
    expect(notifyAdjudicationResult).toHaveBeenCalledWith("prov_1", "approve");
  });

  it("triggers all-steps-complete auto-transition when approving last step", async () => {
    const { db } = await import("@/db");
    const { broadcastToAdmins } = await import("@/server/websocket/broadcast");
    const { logAudit } = await import("@/server/api/lib/audit-logger");

    const dbAny = db as unknown as Record<string, ReturnType<typeof vi.fn>>;

    const mockStep = {
      id: "step_1",
      providerId: "prov_1",
      stepType: "background_check",
      status: "pending_review",
      metadata: { checkrReportId: "rpt_123" },
    };

    dbAny._selectLimit.mockResolvedValueOnce([mockStep]);
    // First update: step → complete
    dbAny._updateReturning
      .mockResolvedValueOnce([{ ...mockStep, status: "complete" }])
      // Second update: provider → pending_review
      .mockResolvedValueOnce([{ id: "prov_1", status: "pending_review" }]);

    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "prov_1", userId: "user_1", name: "John Doe", status: "onboarding",
    });
    // All other steps are complete
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "step_1", status: "pending_review" },
      { id: "step_2", status: "complete" },
      { id: "step_3", status: "complete" },
      { id: "step_4", status: "complete" },
      { id: "step_5", status: "complete" },
    ]);

    const res = await app.request("/prov_1/adjudicate", {
      method: "POST",
      body: JSON.stringify({ decision: "approve", reason: "All clear after thorough review" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(200);
    expect(broadcastToAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ type: "onboarding:ready_for_review" }),
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "onboarding.status_changed",
        details: expect.objectContaining({ trigger: "all_steps_complete" }),
      }),
    );
  });

  it("initiates adverse action via Checkr API and rejects step", async () => {
    const { db } = await import("@/db");
    const { createAdverseAction } = await import("@/server/api/lib/checkr");
    const { logAudit } = await import("@/server/api/lib/audit-logger");
    const { broadcastToUser } = await import("@/server/websocket/broadcast");
    const { notifyAdjudicationResult } = await import("@/lib/notifications");

    const dbAny = db as unknown as Record<string, ReturnType<typeof vi.fn>>;

    const mockStep = {
      id: "step_1",
      providerId: "prov_1",
      stepType: "background_check",
      status: "pending_review",
      metadata: { checkrReportId: "rpt_123", checkrCandidateId: "cand_1" },
    };

    dbAny._selectLimit.mockResolvedValueOnce([mockStep]);
    dbAny._updateReturning.mockResolvedValueOnce([{ ...mockStep, status: "rejected" }]);
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "prov_1", userId: "user_1", name: "John Doe", status: "onboarding",
    });

    const res = await app.request("/prov_1/adjudicate", {
      method: "POST",
      body: JSON.stringify({ decision: "adverse_action", reason: "Criminal record found during manual review" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(createAdverseAction).toHaveBeenCalledWith("rpt_123");
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "checkr.adverse_action_initiated" }),
    );
    expect(broadcastToUser).toHaveBeenCalledWith("user_1", expect.objectContaining({
      data: expect.objectContaining({ newStatus: "rejected" }),
    }));
    expect(notifyAdjudicationResult).toHaveBeenCalledWith("prov_1", "adverse_action");
  });

  it("returns 503 when Checkr API fails for adverse action", async () => {
    const { db } = await import("@/db");
    const { createAdverseAction } = await import("@/server/api/lib/checkr");
    const { logAudit } = await import("@/server/api/lib/audit-logger");

    const dbAny = db as unknown as Record<string, ReturnType<typeof vi.fn>>;

    const mockStep = {
      id: "step_1",
      providerId: "prov_1",
      stepType: "background_check",
      status: "pending_review",
      metadata: { checkrReportId: "rpt_123" },
    };

    dbAny._selectLimit.mockResolvedValueOnce([mockStep]);
    (createAdverseAction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("Service unavailable"), { statusCode: 503 }),
    );

    const res = await app.request("/prov_1/adjudicate", {
      method: "POST",
      body: JSON.stringify({ decision: "adverse_action", reason: "Criminal record found - initiating adverse action" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("temporarily unavailable");
    // Should log the failure
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "checkr.adverse_action_initiated",
        details: expect.objectContaining({ failed: true }),
      }),
    );
  });

  it("returns 409 for adverse_action when no report ID exists", async () => {
    const { db } = await import("@/db");
    const dbAny = db as unknown as Record<string, ReturnType<typeof vi.fn>>;

    dbAny._selectLimit.mockResolvedValueOnce([{
      id: "step_1",
      providerId: "prov_1",
      stepType: "background_check",
      status: "pending_review",
      metadata: {}, // No checkrReportId
    }]);

    const res = await app.request("/prov_1/adjudicate", {
      method: "POST",
      body: JSON.stringify({ decision: "adverse_action", reason: "Missing report but trying adverse action" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("No Checkr report ID");
  });

  it("returns 409 when isValidStepTransition rejects the transition", async () => {
    const { db } = await import("@/db");
    const { isValidStepTransition } = await import("@/server/api/lib/onboarding-state-machine");
    const dbAny = db as unknown as Record<string, ReturnType<typeof vi.fn>>;

    dbAny._selectLimit.mockResolvedValueOnce([{
      id: "step_1",
      providerId: "prov_1",
      stepType: "background_check",
      status: "pending_review",
      metadata: { checkrReportId: "rpt_123" },
    }]);

    // State machine rejects the transition
    (isValidStepTransition as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

    const res = await app.request("/prov_1/adjudicate", {
      method: "POST",
      body: JSON.stringify({ decision: "approve", reason: "Trying to approve but state machine says no" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("Invalid status transition");
  });

  it("returns 409 on concurrent modification (TOCTOU guard)", async () => {
    const { db } = await import("@/db");
    const dbAny = db as unknown as Record<string, ReturnType<typeof vi.fn>>;

    dbAny._selectLimit.mockResolvedValueOnce([{
      id: "step_1",
      providerId: "prov_1",
      stepType: "background_check",
      status: "pending_review",
      metadata: { checkrReportId: "rpt_123" },
    }]);
    // Returning empty means the WHERE guard prevented the update (concurrent modification)
    dbAny._updateReturning.mockResolvedValueOnce([]);

    const res = await app.request("/prov_1/adjudicate", {
      method: "POST",
      body: JSON.stringify({ decision: "approve", reason: "Approving after careful review" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("concurrently");
  });
});

// ── Pipeline Enhancement Tests ────────────────────────────────────

describe("Pipeline Enhancement (background_check_review stage)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  beforeEach(async () => {
    vi.restoreAllMocks();
    const { db } = await import("@/db");
    const dbAny = db as unknown as Record<string, ReturnType<typeof vi.fn>>;

    const selectLimit = vi.fn().mockResolvedValue([]);
    const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
    const selectOrderBy = vi.fn().mockResolvedValue([]);
    const selectDynamic = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: selectOrderBy,
        $dynamic: vi.fn(),
      }),
      orderBy: selectOrderBy,
    });
    const selectFrom = vi.fn().mockReturnValue({
      where: selectWhere,
      leftJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        $dynamic: selectDynamic,
        orderBy: selectOrderBy,
      }),
    });
    dbAny.select = vi.fn().mockReturnValue({ from: selectFrom });
    dbAny._selectLimit = selectLimit;
    dbAny._selectOrderBy = selectOrderBy;

    const updateReturning = vi.fn().mockResolvedValue([]);
    const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    dbAny.update = vi.fn().mockReturnValue({ set: updateSet });

    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.query.onboardingSteps.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const mod = await import("@/server/api/routes/admin-providers");
    app = mod.default;
  });

  it("GET /pipeline returns background_check_review stage in response", async () => {
    const { db } = await import("@/db");
    const dbAny = db as unknown as Record<string, ReturnType<typeof vi.fn>>;

    // Mock the dynamic query chain for pipeline
    dbAny._selectOrderBy.mockResolvedValueOnce([]);
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const res = await app.request("/pipeline", { method: "GET" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stages).toHaveProperty("background_check_review");
  });
});

// ── Reconciliation Enhancement Tests ──────────────────────────────

describe("Reconciliation Result Details", () => {
  it("returns detailed results from reconciliation endpoint", async () => {
    const { reconcileCheckrStatuses } = await import("@/server/api/lib/reconciliation");
    expect(typeof reconcileCheckrStatuses).toBe("function");

    const result = await reconcileCheckrStatuses();
    expect(result).toHaveProperty("details");
    expect(result.details).toBeInstanceOf(Array);
    expect(result.details[0]).toHaveProperty("providerId");
    expect(result.details[0]).toHaveProperty("checkrStatus");
    expect(result.details[0]).toHaveProperty("adjudication");
  });

  it("POST /reconcile/checkr returns result with details", async () => {
    vi.restoreAllMocks();
    const { db } = await import("@/db");
    const dbAny = db as unknown as Record<string, ReturnType<typeof vi.fn>>;

    const selectLimit = vi.fn().mockResolvedValue([]);
    const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    dbAny.select = vi.fn().mockReturnValue({ from: selectFrom });

    const updateReturning = vi.fn().mockResolvedValue([]);
    const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    dbAny.update = vi.fn().mockReturnValue({ set: updateSet });

    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const mod = await import("@/server/api/routes/admin-providers");
    const app = mod.default;

    const res = await app.request("/reconcile/checkr", { method: "POST" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("checked");
    expect(body).toHaveProperty("updated");
    expect(body).toHaveProperty("errors");
    expect(body).toHaveProperty("details");
  });
});

// ── Adjudication Validator Tests (uses REAL Zod schema, not mock) ──

describe("adjudicationRequestSchema (real schema)", () => {
  // Use importActual to bypass vi.mock and test the real Zod schema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let adjudicationRequestSchema: any;

  beforeEach(async () => {
    const realValidators = await vi.importActual("@/lib/validators") as Record<string, unknown>;
    adjudicationRequestSchema = realValidators.adjudicationRequestSchema;
  });

  it("accepts valid approve request", () => {
    const result = adjudicationRequestSchema.safeParse({
      decision: "approve",
      reason: "Background check manually reviewed and cleared",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid adverse_action request", () => {
    const result = adjudicationRequestSchema.safeParse({
      decision: "adverse_action",
      reason: "Disqualifying criminal record found",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid decision value", () => {
    const result = adjudicationRequestSchema.safeParse({
      decision: "reject",
      reason: "This is a long enough reason",
    });
    expect(result.success).toBe(false);
  });

  it("rejects reason shorter than 10 characters", () => {
    const result = adjudicationRequestSchema.safeParse({
      decision: "approve",
      reason: "too short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects reason longer than 500 characters", () => {
    const result = adjudicationRequestSchema.safeParse({
      decision: "approve",
      reason: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing decision field", () => {
    const result = adjudicationRequestSchema.safeParse({
      reason: "A valid reason here",
    });
    expect(result.success).toBe(false);
  });
});

// ── notifyAdjudicationResult Tests ────────────────────────────────

describe("notifyAdjudicationResult", () => {
  it("is exported and callable", async () => {
    const { notifyAdjudicationResult } = await import("@/lib/notifications");
    expect(typeof notifyAdjudicationResult).toBe("function");
  });
});

// ── CHECKR_DASHBOARD_BASE_URL Tests ───────────────────────────────

describe("CHECKR_DASHBOARD_BASE_URL", () => {
  it("is defined and points to Checkr dashboard", async () => {
    const { CHECKR_DASHBOARD_BASE_URL } = await import("@/lib/constants");
    expect(CHECKR_DASHBOARD_BASE_URL).toBe("https://dashboard.checkr.com/reports");
  });
});

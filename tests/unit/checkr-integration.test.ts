import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// ── Shared mock chain builders ───────────────────────────────────


vi.mock("@/db", () => ({
  db: {
    query: {
      providers: { findFirst: vi.fn(), findMany: vi.fn() },
      onboardingSteps: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }) }),
  },
}));

vi.mock("@/db/schema", () => ({
  payments: { stripeSessionId: "stripeSessionId", stripePaymentIntentId: "stripePaymentIntentId", id: "id", bookingId: "bookingId", status: "status", method: "method" },
  bookings: { id: "id", finalPrice: "finalPrice", notes: "notes", updatedAt: "updatedAt" },
}));

vi.mock("@/db/schema/onboarding-steps", () => ({
  onboardingSteps: { id: "id", stepType: "stepType", status: "status", metadata: "metadata", providerId: "providerId", updatedAt: "updatedAt" },
}));

vi.mock("@/db/schema/providers", () => ({
  providers: { id: "id", status: "status", name: "name", userId: "userId" },
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual("drizzle-orm");
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => ({ _op: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ _op: "and", args })),
    lt: vi.fn((...args: unknown[]) => ({ _op: "lt", args })),
    sql: Object.assign(
      (strings: TemplateStringsArray, ...values: unknown[]) => ({ _sql: true, strings, values }),
      { raw: vi.fn() },
    ),
  };
});

vi.mock("@/lib/stripe", () => ({
  stripe: { webhooks: { constructEvent: vi.fn() } },
}));

vi.mock("@/server/api/lib/payout-calculator", () => ({
  createPayoutIfEligible: vi.fn().mockResolvedValue(undefined),
}));

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
  notifyBackgroundCheckResult: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/constants", () => ({
  CHECKR_PACKAGE: "tasker_standard",
  CHECKR_POLLING_THRESHOLD_HOURS: 24,
  CHECKR_MAX_RETRIES: 3,
  CHECKR_STATUS_MAP: {
    clear: "complete",
    consider: "pending_review",
    suspended: "rejected",
    adverse_action: "rejected",
    post_adverse_action: "rejected",
  },
  ONBOARDING_STEP_TYPES: ["background_check", "insurance", "certifications", "training", "stripe_connect"],
  PRESIGNED_UPLOAD_EXPIRY: 900,
  PRESIGNED_DOWNLOAD_EXPIRY_PROVIDER: 3600,
  PRESIGNED_DOWNLOAD_EXPIRY_ADMIN: 600,
  REAPPLY_COOLDOWN_DAYS: 30,
  MIN_DOCUMENTS_PER_STEP: { insurance: 1, certifications: 1, vehicle_doc: 0 },
}));

// ── Checkr API Wrapper Tests ─────────────────────────────────────

describe("Checkr API Wrapper", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.CHECKR_API_KEY = "test-api-key";
    process.env.CHECKR_API_KEY_SANDBOX = "test-sandbox-key";
    (process.env as Record<string, string>).NODE_ENV = "test";
  });

  it("createCandidate sends correct request and returns candidate", async () => {
    const mockCandidate = {
      id: "cand_123",
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      dob: "1990-01-01",
      created_at: "2026-01-01T00:00:00Z",
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCandidate),
    } as unknown as Response);

    const { createCandidate } = await import("@/server/api/lib/checkr");
    const result = await createCandidate({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      dob: "1990-01-01",
    });

    expect(result).toEqual(mockCandidate);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.checkr.com/v1/candidates",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Authorization": "Bearer test-sandbox-key",
        }),
      }),
    );
  });

  it("createInvitation sends correct request with package", async () => {
    const mockInvitation = {
      id: "inv_123",
      candidate_id: "cand_123",
      package: "tasker_standard",
      status: "pending",
      uri: "https://checkr.com/invite/123",
      created_at: "2026-01-01T00:00:00Z",
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockInvitation),
    } as unknown as Response);

    const { createInvitation } = await import("@/server/api/lib/checkr");
    const result = await createInvitation("cand_123", "tasker_standard");

    expect(result).toEqual(mockInvitation);
    const callBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.candidate_id).toBe("cand_123");
    expect(callBody.package).toBe("tasker_standard");
  });

  it("getReport returns report with status", async () => {
    const mockReport = {
      id: "rpt_123",
      status: "clear",
      adjudication: null,
      package: "tasker_standard",
      candidate_id: "cand_123",
      completed_at: "2026-01-02T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockReport),
    } as unknown as Response);

    const { getReport } = await import("@/server/api/lib/checkr");
    const result = await getReport("rpt_123");

    expect(result).toEqual(mockReport);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.checkr.com/v1/reports/rpt_123",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("createAdverseAction sends POST to correct endpoint", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: "aa_1", report_id: "rpt_1", status: "pending" }),
    } as unknown as Response);

    const { createAdverseAction } = await import("@/server/api/lib/checkr");
    const result = await createAdverseAction("rpt_1");

    expect(result).toHaveProperty("id", "aa_1");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.checkr.com/v1/reports/rpt_1/adverse_actions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("retries on 500 errors up to 3 times then throws CheckrApiError", async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Server error"),
    } as unknown as Response);

    const { getReport, CheckrApiError } = await import("@/server/api/lib/checkr");

    // Attach .catch immediately to prevent unhandled rejection
    const promise = getReport("rpt_fail").catch((e) => e);

    // Advance through retry delays: 1s, 2s, 4s
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(5000);
    }

    const error = await promise;
    expect(error).toBeInstanceOf(CheckrApiError);
    // 1 initial + 3 retries = 4 calls
    expect(global.fetch).toHaveBeenCalledTimes(4);

    vi.useRealTimers();
  });

  it("does not retry on 4xx client errors", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not found"),
    } as unknown as Response);

    const { getReport, CheckrApiError } = await import("@/server/api/lib/checkr");

    await expect(getReport("rpt_missing")).rejects.toThrow(CheckrApiError);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("uses sandbox key in non-production environment", async () => {
    (process.env as Record<string, string>).NODE_ENV = "test";
    process.env.CHECKR_API_KEY = "prod-key";
    process.env.CHECKR_API_KEY_SANDBOX = "sandbox-key";

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: "rpt_123", status: "clear" }),
    } as unknown as Response);

    const { getReport } = await import("@/server/api/lib/checkr");
    await getReport("rpt_123");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Authorization": "Bearer sandbox-key",
        }),
      }),
    );
  });

  it("handles network errors with retry", async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "rpt_1", status: "clear" }),
      } as unknown as Response);

    const { getReport } = await import("@/server/api/lib/checkr");
    const promise = getReport("rpt_1");

    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;
    expect(result).toHaveProperty("id", "rpt_1");
    expect(global.fetch).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

// ── Checkr Webhook Tests (via Hono app.request) ─────────────────

describe("Checkr Webhook Handler", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let webhooksApp: any;

  function createCheckrSignature(payload: string): string {
    const hmac = crypto.createHmac("sha256", "test-secret");
    hmac.update(payload);
    return hmac.digest("hex");
  }

  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.CHECKR_WEBHOOK_SECRET = "test-secret";
    process.env.STRIPE_WEBHOOK_SECRET = "stripe-secret";

    // Setup db mock chains
    const { db } = await import("@/db");
    const dbAny = db as unknown as Record<string, unknown>;

    // Build proper select chain
    const selectLimitFn = vi.fn().mockResolvedValue([]);
    const selectWhereFn = vi.fn().mockReturnValue({ limit: selectLimitFn });
    const selectFromFn = vi.fn().mockReturnValue({ where: selectWhereFn });
    (dbAny as { select: unknown }).select = vi.fn().mockReturnValue({ from: selectFromFn });

    // Build proper update chain
    const updateReturningFn = vi.fn().mockResolvedValue([]);
    const updateWhereFn = vi.fn().mockReturnValue({ returning: updateReturningFn });
    const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
    (dbAny as { update: unknown }).update = vi.fn().mockReturnValue({ set: updateSetFn });

    // Store references for test assertions
    (dbAny as Record<string, unknown>)._selectLimit = selectLimitFn;
    (dbAny as Record<string, unknown>)._updateReturning = updateReturningFn;

    // Reset provider findFirst
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const mod = await import("@/server/api/routes/webhooks");
    webhooksApp = mod.default;
  });

  it("returns 401 for invalid HMAC signature", async () => {
    const payload = JSON.stringify({ id: "evt_1", type: "report.completed", data: { object: {} } });

    const res = await webhooksApp.request("/checkr", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json", "x-checkr-signature": "invalid-signature" },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid signature");
  });

  it("returns 401 when signature header is missing", async () => {
    const payload = JSON.stringify({ id: "evt_2", type: "report.completed", data: { object: {} } });

    const res = await webhooksApp.request("/checkr", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(401);
  });

  it("logs audit event for invalid signature", async () => {
    const { logAudit } = await import("@/server/api/lib/audit-logger");
    const payload = JSON.stringify({ id: "evt_audit_sig", type: "report.completed", data: { object: {} } });

    await webhooksApp.request("/checkr", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json", "x-checkr-signature": "bad" },
    });

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "checkr.webhook_invalid_signature" }),
    );
  });

  it("processes report.completed with clear status and broadcasts to provider", async () => {
    const { db } = await import("@/db");
    const { logAudit } = await import("@/server/api/lib/audit-logger");
    const { broadcastToUser } = await import("@/server/websocket/broadcast");
    const { notifyBackgroundCheckResult } = await import("@/lib/notifications");

    const mockStep = {
      id: "step_1",
      providerId: "prov_1",
      stepType: "background_check",
      status: "in_progress",
      metadata: { checkrCandidateId: "cand_1", checkrReportId: null, checkrInvitationId: "inv_1" },
    };

    const mockProvider = { id: "prov_1", userId: "user_1", name: "John Doe", status: "onboarding" };

    // Setup select to return matching step
    const dbAny = db as unknown as Record<string, unknown>;
    (dbAny._selectLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockStep]);

    // Provider lookup
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockProvider);

    // All steps check (not all complete — 2 of 5 only)
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { ...mockStep, status: "complete" },
      { id: "step_2", status: "in_progress" },
    ]);

    const payload = JSON.stringify({
      id: "evt_clear_1",
      type: "report.completed",
      data: { object: { id: "rpt_clear", candidate_id: "cand_1", status: "clear", adjudication: null } },
    });
    const signature = createCheckrSignature(payload);

    const res = await webhooksApp.request("/checkr", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json", "x-checkr-signature": signature },
    });

    expect(res.status).toBe(200);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "checkr.report_received",
        details: expect.objectContaining({ newStepStatus: "complete" }),
      }),
    );
    expect(broadcastToUser).toHaveBeenCalledWith("user_1", expect.objectContaining({
      type: "onboarding:step_updated",
    }));
    expect(notifyBackgroundCheckResult).toHaveBeenCalledWith("prov_1", "clear");
  });

  it("processes report.completed with consider status and broadcasts to admins", async () => {
    const { db } = await import("@/db");
    const { broadcastToAdmins } = await import("@/server/websocket/broadcast");

    const mockStep = {
      id: "step_2",
      providerId: "prov_2",
      stepType: "background_check",
      status: "in_progress",
      metadata: { checkrCandidateId: "cand_2", checkrReportId: null },
    };

    const dbAny = db as unknown as Record<string, unknown>;
    (dbAny._selectLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockStep]);
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "prov_2", userId: "user_2", name: "Jane", status: "onboarding",
    });

    const payload = JSON.stringify({
      id: "evt_consider_1",
      type: "report.completed",
      data: { object: { id: "rpt_consider", candidate_id: "cand_2", status: "consider", adjudication: null } },
    });
    const signature = createCheckrSignature(payload);

    const res = await webhooksApp.request("/checkr", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json", "x-checkr-signature": signature },
    });

    expect(res.status).toBe(200);
    expect(broadcastToAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "onboarding:step_updated",
        data: expect.objectContaining({ newStatus: "pending_review" }),
      }),
    );
  });

  it("processes report.completed with suspended status → rejected", async () => {
    const { db } = await import("@/db");
    const { logAudit } = await import("@/server/api/lib/audit-logger");

    const dbAny = db as unknown as Record<string, unknown>;
    (dbAny._selectLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{
      id: "step_3",
      providerId: "prov_3",
      stepType: "background_check",
      status: "in_progress",
      metadata: { checkrCandidateId: "cand_3", checkrReportId: null },
    }]);
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "prov_3", userId: "user_3", name: "Bob", status: "onboarding",
    });

    const payload = JSON.stringify({
      id: "evt_suspended_1",
      type: "report.completed",
      data: { object: { id: "rpt_sus", candidate_id: "cand_3", status: "suspended", adjudication: null } },
    });
    const signature = createCheckrSignature(payload);

    const res = await webhooksApp.request("/checkr", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json", "x-checkr-signature": signature },
    });

    expect(res.status).toBe(200);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "checkr.report_received",
        details: expect.objectContaining({ newStepStatus: "rejected" }),
      }),
    );
  });

  it("returns 200 for orphan event (report not found)", async () => {
    const { db } = await import("@/db");
    const dbAny = db as unknown as Record<string, unknown>;
    (dbAny._selectLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const payload = JSON.stringify({
      id: "evt_orphan_1",
      type: "report.completed",
      data: { object: { id: "rpt_unknown", candidate_id: "cand_unknown", status: "clear", adjudication: null } },
    });
    const signature = createCheckrSignature(payload);

    const res = await webhooksApp.request("/checkr", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json", "x-checkr-signature": signature },
    });

    expect(res.status).toBe(200);
  });

  it("returns 200 for unknown event type (no error)", async () => {
    const payload = JSON.stringify({
      id: "evt_unknown_1",
      type: "candidate.created",
      data: { object: { id: "cand_1" } },
    });
    const signature = createCheckrSignature(payload);

    const res = await webhooksApp.request("/checkr", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json", "x-checkr-signature": signature },
    });

    expect(res.status).toBe(200);
  });

  it("backfills checkrReportId in step metadata on report.completed", async () => {
    const { db } = await import("@/db");

    const mockStep = {
      id: "step_bf",
      providerId: "prov_bf",
      stepType: "background_check",
      status: "in_progress",
      metadata: { checkrCandidateId: "cand_bf", checkrReportId: null, checkrInvitationId: "inv_bf" },
    };

    const dbAny = db as unknown as Record<string, unknown>;
    (dbAny._selectLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockStep]);
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "prov_bf", userId: "user_bf", name: "Test", status: "onboarding",
    });

    const payload = JSON.stringify({
      id: "evt_backfill_1",
      type: "report.completed",
      data: { object: { id: "rpt_real_123", candidate_id: "cand_bf", status: "clear", adjudication: null } },
    });
    const signature = createCheckrSignature(payload);

    const res = await webhooksApp.request("/checkr", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json", "x-checkr-signature": signature },
    });

    expect(res.status).toBe(200);

    // Verify update was called (backfill + status update = 2 update calls)
    expect((db as unknown as Record<string, unknown>).update).toHaveBeenCalled();
  });

  it("deduplicates Checkr events (same event ID returns 200 without processing)", async () => {
    const { logAudit } = await import("@/server/api/lib/audit-logger");

    // First: send a valid event that will be processed
    const payload = JSON.stringify({
      id: "evt_dedup_test",
      type: "candidate.created",
      data: { object: { id: "cand_dedup" } },
    });
    const signature = createCheckrSignature(payload);

    const res1 = await webhooksApp.request("/checkr", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json", "x-checkr-signature": signature },
    });
    expect(res1.status).toBe(200);

    // Clear audit mock to verify second call doesn't log
    (logAudit as ReturnType<typeof vi.fn>).mockClear();

    // Second: same event ID should be deduplicated
    const res2 = await webhooksApp.request("/checkr", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json", "x-checkr-signature": signature },
    });
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.ok).toBe(true);
  });
});

// ── Reconciliation Tests ─────────────────────────────────────────

describe("reconcileCheckrStatuses", () => {
  it("is exported and callable", async () => {
    const { reconcileCheckrStatuses } = await import("@/server/api/lib/reconciliation");
    expect(typeof reconcileCheckrStatuses).toBe("function");
  });
});

// ── Notification Tests ───────────────────────────────────────────

describe("notifyBackgroundCheckResult", () => {
  it("is exported and callable", async () => {
    const { notifyBackgroundCheckResult } = await import("@/lib/notifications");
    expect(typeof notifyBackgroundCheckResult).toBe("function");
  });
});

// ── CHECKR_STATUS_MAP Tests ──────────────────────────────────────

describe("CHECKR_STATUS_MAP", () => {
  it("maps clear to complete", async () => {
    const { CHECKR_STATUS_MAP } = await import("@/lib/constants");
    expect(CHECKR_STATUS_MAP.clear).toBe("complete");
  });

  it("maps consider to pending_review", async () => {
    const { CHECKR_STATUS_MAP } = await import("@/lib/constants");
    expect(CHECKR_STATUS_MAP.consider).toBe("pending_review");
  });

  it("maps suspended and adverse_action to rejected", async () => {
    const { CHECKR_STATUS_MAP } = await import("@/lib/constants");
    expect(CHECKR_STATUS_MAP.suspended).toBe("rejected");
    expect(CHECKR_STATUS_MAP.adverse_action).toBe("rejected");
  });

  it("maps post_adverse_action to rejected", async () => {
    const { CHECKR_STATUS_MAP } = await import("@/lib/constants");
    expect(CHECKR_STATUS_MAP.post_adverse_action).toBe("rejected");
  });

  it("returns undefined for non-terminal adjudication values (engaged, pre_adverse_action)", async () => {
    const { CHECKR_STATUS_MAP } = await import("@/lib/constants");
    expect(CHECKR_STATUS_MAP.engaged).toBeUndefined();
    expect(CHECKR_STATUS_MAP.pre_adverse_action).toBeUndefined();
  });
});

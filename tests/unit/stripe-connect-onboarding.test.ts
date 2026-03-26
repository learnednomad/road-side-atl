import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock chain state ──────────────────────────────────────────────

let mockUpdateSetCalls: unknown[][] = [];
let mockUpdateReturnValues: unknown[][] = [];
let mockSelectReturnValues: unknown[][] = [];

const createUpdateChain = () => {
  const returning = vi.fn().mockImplementation(() =>
    Promise.resolve(mockUpdateReturnValues.shift() || []),
  );
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockImplementation((...args: unknown[]) => {
    mockUpdateSetCalls.push(args);
    return { where };
  });
  return { set, where, returning };
};

const createSelectChain = () => {
  const where = vi.fn().mockImplementation(() =>
    Promise.resolve(mockSelectReturnValues.shift() || []),
  );
  const from = vi.fn().mockReturnValue({ where });
  return { from, where };
};

let updateChain = createUpdateChain();
let selectChain = createSelectChain();

vi.mock("@/db", () => ({
  db: {
    query: {
      providers: { findFirst: vi.fn(), findMany: vi.fn() },
      onboardingSteps: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    select: vi.fn().mockImplementation(() => ({ from: selectChain.from })),
    update: vi.fn().mockImplementation(() => ({ set: updateChain.set })),
  },
}));

vi.mock("@/db/schema", () => ({
  payments: {},
  bookings: {},
}));

vi.mock("@/db/schema/onboarding-steps", () => ({
  onboardingSteps: {
    id: "id", stepType: "stepType", status: "status",
    metadata: "metadata", providerId: "providerId", updatedAt: "updatedAt",
  },
}));

vi.mock("@/db/schema/providers", () => ({
  providers: {
    id: "id", status: "status", name: "name", userId: "userId",
    email: "email", stripeConnectAccountId: "stripeConnectAccountId",
  },
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual("drizzle-orm");
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => ({ _op: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ _op: "and", args })),
    lt: vi.fn((...args: unknown[]) => ({ _op: "lt", args })),
    isNull: vi.fn(),
    asc: vi.fn(),
    sql: Object.assign(
      (strings: TemplateStringsArray, ...values: unknown[]) => ({ _sql: true, strings, values }),
      { raw: vi.fn() },
    ),
  };
});

const mockStripe = {
  accounts: {
    create: vi.fn(),
    retrieve: vi.fn(),
    createLoginLink: vi.fn(),
  },
  accountLinks: {
    create: vi.fn(),
  },
  webhooks: { constructEvent: vi.fn() },
};

vi.mock("@/lib/stripe", () => ({
  stripe: new Proxy({}, {
    get(_, prop) {
      return (mockStripe as Record<string, unknown>)[prop as string];
    },
  }),
}));

vi.mock("@/server/api/lib/payout-calculator", () => ({
  createPayoutIfEligible: vi.fn().mockResolvedValue(undefined),
  migratePendingPayoutsToConnect: vi.fn().mockResolvedValue({ migrated: 0, errors: 0 }),
}));

vi.mock("@/server/api/lib/audit-logger", () => ({
  logAudit: vi.fn(),
  getRequestInfo: vi.fn().mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "test" }),
}));

vi.mock("@/server/api/lib/onboarding-state-machine", () => ({
  isValidStepTransition: vi.fn().mockReturnValue(true),
  isValidProviderTransition: vi.fn().mockReturnValue(true),
}));

vi.mock("@/server/api/lib/all-steps-complete", () => ({
  checkAllStepsCompleteAndTransition: vi.fn().mockResolvedValue(false),
  onStripeConnectStepComplete: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/websocket/broadcast", () => ({
  broadcastToUser: vi.fn(),
  broadcastToAdmins: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  notifyBackgroundCheckResult: vi.fn().mockResolvedValue(undefined),
  notifyStripeConnectReminder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/s3", () => ({
  getPresignedUploadUrl: vi.fn().mockResolvedValue("https://s3.test/upload"),
  getPresignedUrl: vi.fn().mockResolvedValue("https://s3.test/download"),
}));

vi.mock("@/lib/validators", () => ({
  providerApplicationSchema: { safeParse: vi.fn() },
  inviteAcceptSchema: { safeParse: vi.fn() },
  providerStepUpdateSchema: { safeParse: vi.fn() },
  documentUploadUrlSchema: { safeParse: vi.fn() },
  documentCreateSchema: { safeParse: vi.fn() },
}));

vi.mock("@/lib/constants", () => ({
  ONBOARDING_STEP_TYPES: ["background_check", "insurance", "certifications", "vehicle_info", "stripe_connect"],
  REAPPLY_COOLDOWN_DAYS: 30,
  PRESIGNED_UPLOAD_EXPIRY: 300,
  PRESIGNED_DOWNLOAD_EXPIRY_PROVIDER: 3600,
  MIN_DOCUMENTS_PER_STEP: { insurance: 1, certifications: 1 },
  CHECKR_PACKAGE: "driver_pro",
  CHECKR_POLLING_THRESHOLD_HOURS: 24,
  CHECKR_STATUS_MAP: { clear: "complete", consider: "pending_review" },
}));

vi.mock("@/server/api/middleware/auth", () => ({
  requireAuth: vi.fn(async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set("user", { id: "user-1", role: "provider", name: "Test Provider", email: "test@example.com" });
    return next();
  }),
  requireAdmin: vi.fn(async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set("user", { id: "admin-1", role: "admin", name: "Admin", email: "admin@example.com" });
    return next();
  }),
  requireProvider: vi.fn(async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set("user", { id: "user-1", role: "provider", name: "Test Provider", email: "test@example.com" });
    return next();
  }),
}));

vi.mock("@/server/api/middleware/rate-limit", () => ({
  rateLimitStrict: vi.fn((_c: unknown, next: () => Promise<void>) => next()),
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed") },
}));

vi.mock("@/server/api/lib/checkr", () => ({
  createCandidate: vi.fn(),
  createInvitation: vi.fn(),
  CheckrApiError: class extends Error { statusCode: number; constructor(m: string, s: number) { super(m); this.statusCode = s; } },
  getReport: vi.fn(),
}));

vi.mock("@/db/schema/provider-documents", () => ({
  providerDocuments: {},
}));

vi.mock("@/db/schema/provider-invites", () => ({
  providerInvites: {},
}));

vi.mock("@/db/schema/users", () => ({
  users: { id: "id", email: "email", name: "name" },
}));

// ── Test imports ──────────────────────────────────────────────────

import { db } from "@/db";
import { logAudit } from "@/server/api/lib/audit-logger";
import { isValidStepTransition } from "@/server/api/lib/onboarding-state-machine";
import { broadcastToUser, broadcastToAdmins } from "@/server/websocket/broadcast";

// ── Shared fixtures ──────────────────────────────────────────────

const mockProvider = {
  id: "provider-1",
  userId: "user-1",
  name: "Test Provider",
  email: "test@example.com",
  phone: "+1555000000",
  status: "onboarding",
  stripeConnectAccountId: null as string | null,
};

const mockStep = {
  id: "step-1",
  providerId: "provider-1",
  stepType: "stripe_connect",
  status: "pending",
  metadata: null as Record<string, unknown> | null,
  completedAt: null,
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateSetCalls = [];
  mockUpdateReturnValues = [];
  mockSelectReturnValues = [];
  updateChain = createUpdateChain();
  selectChain = createSelectChain();

  // Re-wire db mock to new chains
  (db.update as ReturnType<typeof vi.fn>).mockImplementation(() => ({ set: updateChain.set }));
  (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({ from: selectChain.from }));

  // Default query mocks
  (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockProvider });
  (db.query.onboardingSteps.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockStep });
  (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

  // Default Stripe mocks
  mockStripe.accounts.create.mockResolvedValue({ id: "acct_test123" });
  mockStripe.accountLinks.create.mockResolvedValue({ url: "https://connect.stripe.com/setup/test" });
  mockStripe.accounts.retrieve.mockResolvedValue({ charges_enabled: false, details_submitted: false });
  mockStripe.accounts.createLoginLink.mockResolvedValue({ url: "https://connect.stripe.com/express/login" });

  (isValidStepTransition as ReturnType<typeof vi.fn>).mockReturnValue(true);
});

// ── POST /stripe-link ──────────────────────────────────────────────

describe("POST /stripe-link", () => {
  let app: Awaited<typeof import("@/server/api/routes/onboarding")>["default"];

  beforeEach(async () => {
    const mod = await import("@/server/api/routes/onboarding");
    app = mod.default;
  });

  const req = () => app.request("/stripe-link", { method: "POST" });

  it("creates new account and returns link URL when no account exists", async () => {
    const res = await req();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://connect.stripe.com/setup/test");
    expect(mockStripe.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "express", email: "test@example.com" }),
    );
  });

  it("generates new link only when account already exists (re-entry flow)", async () => {
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProvider,
      stripeConnectAccountId: "acct_existing",
    });

    const res = await req();
    expect(res.status).toBe(200);
    expect(mockStripe.accounts.create).not.toHaveBeenCalled();
    expect(mockStripe.accountLinks.create).toHaveBeenCalledWith(
      expect.objectContaining({ account: "acct_existing" }),
    );
  });

  it("returns 503 when Stripe API fails", async () => {
    mockStripe.accounts.create.mockRejectedValue(new Error("Stripe down"));

    const res = await req();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Payment setup temporarily unavailable");
  });

  it("logs audit events for account creation and link generation", async () => {
    await req();

    const actions = (logAudit as ReturnType<typeof vi.fn>).mock.calls
      .map((c: unknown[]) => (c[0] as Record<string, unknown>).action);
    expect(actions).toContain("stripe_connect.account_created");
    expect(actions).toContain("stripe_connect.link_generated");
  });

  it("transitions step pending → in_progress via state machine", async () => {
    await req();
    expect(isValidStepTransition).toHaveBeenCalledWith("pending", "in_progress");
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "in_progress" }),
    );
  });

  it("returns 404 when provider not found", async () => {
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await req();
    expect(res.status).toBe(404);
  });
});

// ── GET /stripe-status ──────────────────────────────────────────────

describe("GET /stripe-status", () => {
  let app: Awaited<typeof import("@/server/api/routes/onboarding")>["default"];

  beforeEach(async () => {
    const mod = await import("@/server/api/routes/onboarding");
    app = mod.default;
  });

  const req = () => app.request("/stripe-status", { method: "GET" });

  it("transitions step to complete when charges_enabled is true", async () => {
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProvider,
      stripeConnectAccountId: "acct_test",
    });
    (db.query.onboardingSteps.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockStep,
      status: "in_progress",
      metadata: { stripeConnectAccountId: "acct_test" },
    });
    mockStripe.accounts.retrieve.mockResolvedValue({ charges_enabled: true, details_submitted: true });
    mockUpdateReturnValues.push([{ id: "step-1", status: "complete" }]);

    // Not all steps complete
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "step-1", status: "complete" },
      { id: "step-2", status: "in_progress" },
    ]);

    const res = await req();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("complete");
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "stripe_connect.onboarding_completed" }),
    );
  });

  it("returns pending when charges_enabled is false", async () => {
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProvider,
      stripeConnectAccountId: "acct_test",
    });
    mockStripe.accounts.retrieve.mockResolvedValue({ charges_enabled: false, details_submitted: true });

    const res = await req();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("pending");
    expect(body.details_submitted).toBe(true);
  });

  it("returns 404 when no Connect account exists", async () => {
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProvider,
      stripeConnectAccountId: null,
    });
    const res = await req();
    expect(res.status).toBe(404);
  });

  it("returns 503 when Stripe API fails", async () => {
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProvider,
      stripeConnectAccountId: "acct_test",
    });
    mockStripe.accounts.retrieve.mockRejectedValue(new Error("Stripe down"));

    const res = await req();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Payment status check temporarily unavailable");
  });

  it("calls checkAllStepsCompleteAndTransition when step completes", async () => {
    const { checkAllStepsCompleteAndTransition } = await import("@/server/api/lib/all-steps-complete");

    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProvider,
      stripeConnectAccountId: "acct_test",
    });
    (db.query.onboardingSteps.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockStep,
      status: "in_progress",
    });
    mockStripe.accounts.retrieve.mockResolvedValue({ charges_enabled: true, details_submitted: true });
    mockUpdateReturnValues.push([{ id: "step-1", status: "complete" }]);

    await req();

    expect(checkAllStepsCompleteAndTransition).toHaveBeenCalledWith(
      "provider-1", "step-1", "stripe_status_check",
      expect.objectContaining({ userId: "user-1" }),
      expect.objectContaining({ id: "provider-1" }),
    );
  });
});

// ── GET /stripe-dashboard ──────────────────────────────────────────

describe("GET /stripe-dashboard", () => {
  let app: Awaited<typeof import("@/server/api/routes/onboarding")>["default"];

  beforeEach(async () => {
    const mod = await import("@/server/api/routes/onboarding");
    app = mod.default;
  });

  const req = () => app.request("/stripe-dashboard", { method: "GET" });

  it("returns login link when step is complete", async () => {
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProvider,
      stripeConnectAccountId: "acct_test",
    });
    (db.query.onboardingSteps.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockStep,
      status: "complete",
    });

    const res = await req();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://connect.stripe.com/express/login");
  });

  it("returns 403 when step not complete", async () => {
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProvider,
      stripeConnectAccountId: "acct_test",
    });
    (db.query.onboardingSteps.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockStep,
      status: "in_progress",
    });

    const res = await req();
    expect(res.status).toBe(403);
  });

  it("returns 404 when no Connect account", async () => {
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProvider,
      stripeConnectAccountId: null,
    });

    const res = await req();
    expect(res.status).toBe(404);
  });
});

// ── account.updated webhook ──────────────────────────────────────

describe("account.updated webhook", () => {
  let webhookApp: Awaited<typeof import("@/server/api/routes/webhooks")>["default"];

  beforeEach(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const mod = await import("@/server/api/routes/webhooks");
    webhookApp = mod.default;
  });

  function webhookReq(event: Record<string, unknown>) {
    const body = JSON.stringify(event);
    mockStripe.webhooks.constructEvent.mockReturnValue(event);
    return webhookApp.request("/stripe", {
      method: "POST",
      body,
      headers: { "Content-Type": "text/plain", "stripe-signature": "test-sig" },
    });
  }

  it("transitions step to complete when charges_enabled is true", async () => {
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProvider,
      stripeConnectAccountId: "acct_connect",
    });
    (db.query.onboardingSteps.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockStep,
      status: "in_progress",
      metadata: { stripeConnectAccountId: "acct_connect" },
    });
    mockUpdateReturnValues.push([{ id: "step-1", status: "complete" }]);
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "step-1", status: "complete" },
      { id: "step-2", status: "in_progress" },
    ]);

    const res = await webhookReq({
      id: "evt_1",
      type: "account.updated",
      data: { object: { id: "acct_connect", charges_enabled: true } },
    });

    expect(res.status).toBe(200);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "stripe_connect.onboarding_completed" }),
    );
  });

  it("does nothing when charges_enabled is false", async () => {
    const res = await webhookReq({
      id: "evt_2",
      type: "account.updated",
      data: { object: { id: "acct_x", charges_enabled: false } },
    });

    expect(res.status).toBe(200);
    // Provider lookup should NOT happen when charges_enabled is false
    expect(db.query.providers.findFirst).not.toHaveBeenCalled();
  });

  it("returns 200 for unknown account (orphan event)", async () => {
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await webhookReq({
      id: "evt_3",
      type: "account.updated",
      data: { object: { id: "acct_orphan", charges_enabled: true } },
    });

    expect(res.status).toBe(200);
  });

  it("does not double-transition when step already complete (TOCTOU)", async () => {
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProvider,
      stripeConnectAccountId: "acct_done",
    });
    (db.query.onboardingSteps.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockStep,
      status: "complete",
    });
    (isValidStepTransition as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const res = await webhookReq({
      id: "evt_4",
      type: "account.updated",
      data: { object: { id: "acct_done", charges_enabled: true } },
    });

    expect(res.status).toBe(200);
    expect(logAudit).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "stripe_connect.onboarding_completed" }),
    );
  });
});

// ── Reconciliation ─────────────────────────────────────────────────

describe("reconcileStripeConnectStatuses", () => {
  let reconcileStripeConnectStatuses: () => Promise<import("@/server/api/lib/reconciliation").ReconciliationResult>;

  beforeEach(async () => {
    const mod = await import("@/server/api/lib/reconciliation");
    reconcileStripeConnectStatuses = mod.reconcileStripeConnectStatuses;
  });

  it("finds stale accounts and transitions enabled ones to complete", async () => {
    const staleStep = {
      id: "step-stale",
      providerId: "provider-1",
      stepType: "stripe_connect",
      status: "in_progress",
      metadata: { stripeConnectAccountId: "acct_stale" },
      updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    };

    // db.select().from().where() returns stale steps
    mockSelectReturnValues.push([staleStep]);
    mockStripe.accounts.retrieve.mockResolvedValue({ charges_enabled: true, details_submitted: true });

    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockProvider);
    (db.query.onboardingSteps.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "step-stale", status: "complete" },
      { id: "step-2", status: "in_progress" },
    ]);

    const result = await reconcileStripeConnectStatuses();

    expect(result.checked).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.errors).toBe(0);
    expect(result.details[0]?.newStatus).toBe("complete");
  });

  it("skips accounts where charges_enabled is still false", async () => {
    mockSelectReturnValues.push([{
      id: "step-pending",
      providerId: "provider-1",
      status: "in_progress",
      metadata: { stripeConnectAccountId: "acct_not_ready" },
      updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    }]);
    mockStripe.accounts.retrieve.mockResolvedValue({ charges_enabled: false });

    const result = await reconcileStripeConnectStatuses();
    expect(result.checked).toBe(1);
    expect(result.updated).toBe(0);
  });
});

// ── Abandonment Reminders ─────────────────────────────────────────

describe("checkStripeConnectAbandonment", () => {
  let checkStripeConnectAbandonment: () => Promise<import("@/server/api/lib/reconciliation").AbandonmentResult>;

  beforeEach(async () => {
    const mod = await import("@/server/api/lib/reconciliation");
    checkStripeConnectAbandonment = mod.checkStripeConnectAbandonment;
  });

  it("sends first reminder after 24 hours", async () => {
    mockSelectReturnValues.push([{
      id: "step-abandoned",
      providerId: "provider-1",
      status: "in_progress",
      metadata: { stripeConnectAccountId: "acct_1", remindersSent: 0 },
      updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    }]);

    const result = await checkStripeConnectAbandonment();
    expect(result.reminded).toBe(1);
  });

  it("sends second reminder after 72 hours", async () => {
    mockSelectReturnValues.push([{
      id: "step-old",
      providerId: "provider-1",
      status: "in_progress",
      metadata: { stripeConnectAccountId: "acct_2", remindersSent: 1 },
      updatedAt: new Date(Date.now() - 73 * 60 * 60 * 1000),
    }]);

    const result = await checkStripeConnectAbandonment();
    expect(result.reminded).toBe(1);
  });

  it("does not duplicate reminders when already sent both", async () => {
    mockSelectReturnValues.push([{
      id: "step-done",
      providerId: "provider-1",
      status: "in_progress",
      metadata: { stripeConnectAccountId: "acct_3", remindersSent: 2 },
      updatedAt: new Date(Date.now() - 100 * 60 * 60 * 1000),
    }]);

    const result = await checkStripeConnectAbandonment();
    expect(result.reminded).toBe(0);
  });
});

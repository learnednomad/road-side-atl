import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Mocks — declared before importing the module under test. The DB mock is the
// SOLE controllable throw source; every other collaborator is a no-op spy.
// ---------------------------------------------------------------------------

// Shared mocks must be hoisted so the (hoisted) vi.mock factories below can
// reference them without a TDZ error.
const {
  mockWebhookEventsFindFirst,
  mockProvidersFindFirst,
  mockPaymentsFindFirst,
  mockSelectLimit,
  mockTxUpdateWhere,
  insertCalls,
  txMock,
  mockDbInsert,
} = vi.hoisted(() => {
  // Leaf result mocks (controllable per-test).
  const mockWebhookEventsFindFirst = vi.fn();
  const mockProvidersFindFirst = vi.fn();
  const mockPaymentsFindFirst = vi.fn();
  const mockSelectLimit = vi.fn();
  const mockTxUpdateWhere = vi.fn();

  // Captures every db.insert(table).values(vals) call so we can do the canonical
  // table-identity dedup assertion (never blanket): a row is "written" iff its
  // table object identity appears here.
  const insertCalls: Array<{ table: unknown; vals: unknown }> = [];

  // tx passed to db.transaction — its update chain ends at mockTxUpdateWhere so a
  // rejected where() aborts the (mocked) transaction and propagates.
  const txMock = {
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: mockTxUpdateWhere })) })),
  };

  const mockDbInsert = vi.fn((table: unknown) => ({
    values: vi.fn((vals: unknown) => {
      insertCalls.push({ table, vals });
      return {
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockResolvedValue([{ id: "generated" }]),
      };
    }),
  }));

  return {
    mockWebhookEventsFindFirst,
    mockProvidersFindFirst,
    mockPaymentsFindFirst,
    mockSelectLimit,
    mockTxUpdateWhere,
    insertCalls,
    txMock,
    mockDbInsert,
  };
});

vi.mock("@/db", () => ({
  db: {
    query: {
      payments: { findFirst: mockPaymentsFindFirst },
      bookings: { findFirst: vi.fn() },
      providerPayouts: { findFirst: vi.fn() },
      providers: { findFirst: mockProvidersFindFirst },
      webhookEvents: { findFirst: mockWebhookEventsFindFirst },
    },
    insert: mockDbInsert,
    // Non-tx update (unused by the Checkr path now, kept chainable for safety).
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: mockSelectLimit })) })),
    })),
    // Propagates rejections from the callback (fail-closed semantics).
    transaction: vi.fn(async (cb: (tx: typeof txMock) => unknown) => await cb(txMock)),
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: { webhooks: { constructEvent: vi.fn() } },
}));

vi.mock("@/server/api/lib/payout-calculator", () => ({
  createPayoutIfEligible: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/server/api/lib/audit-logger", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/api/lib/ops-alerts", () => ({
  sendOpsAlert: vi.fn(),
}));

vi.mock("@/server/api/lib/onboarding-state-machine", () => ({
  isValidStepTransition: vi.fn(() => true),
}));

vi.mock("@/server/websocket/broadcast", () => ({
  broadcastToUser: vi.fn(),
  broadcastToAdmins: vi.fn(),
  broadcastToProvider: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  notifyBackgroundCheckResult: vi.fn().mockResolvedValue(undefined),
  notifyStripeConnectCompleted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/novu", () => ({
  triggerNovu: vi.fn().mockResolvedValue(undefined),
  syncSubscriber: vi.fn().mockResolvedValue(undefined),
  WF: {},
  custSub: vi.fn((id: string) => id),
  provSub: vi.fn((id: string) => `provider:${id}`),
  adminsTopic: vi.fn(() => "admins"),
  money: vi.fn((n: number) => `$${n}`),
}));

vi.mock("@/server/api/lib/all-steps-complete", () => ({
  checkAllStepsCompleteAndTransition: vi.fn().mockResolvedValue(undefined),
  onStripeConnectStepComplete: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/api/lib/webhook-handlers/stripe-extensions", () => ({
  stripeExtensionHandlers: {
    "test.ext.throw": vi.fn(),
    "test.ext.ok": vi.fn(),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ _op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ _op: "and", args })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...args: unknown[]) => ({ _op: "sql", strings, args })),
    { raw: vi.fn((s: string) => ({ _op: "sql.raw", s })) },
  ),
}));

// Schema table objects — identity matters for the dedup assertion.
vi.mock("@/db/schema", () => ({
  payments: { id: "id", stripePaymentIntentId: "stripePaymentIntentId", bookingId: "bookingId", method: "method", status: "status" },
  bookings: { id: "id" },
  providerPayouts: { id: "id" },
  webhookEvents: { id: "id", source: "source", status: "status", eventType: "eventType", processedAt: "processedAt" },
  users: { id: "id", stripeIdentitySessionId: "stripeIdentitySessionId" },
}));

vi.mock("@/db/schema/onboarding-steps", () => ({
  onboardingSteps: {
    id: "id",
    providerId: "providerId",
    stepType: "stepType",
    status: "status",
    metadata: "metadata",
  },
}));

vi.mock("@/db/schema/providers", () => ({
  providers: { id: "id", userId: "userId" },
}));

// ---------------------------------------------------------------------------
// Imports under test + typed mock references
// ---------------------------------------------------------------------------

import { stripe } from "@/lib/stripe";
import { sendOpsAlert } from "@/server/api/lib/ops-alerts";
import { checkAllStepsCompleteAndTransition } from "@/server/api/lib/all-steps-complete";
import { stripeExtensionHandlers } from "@/server/api/lib/webhook-handlers/stripe-extensions";
import app from "@/server/api/routes/webhooks";

const mockConstructEvent = stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>;
const mockSendOpsAlert = sendOpsAlert as ReturnType<typeof vi.fn>;
const mockCheckAllSteps = checkAllStepsCompleteAndTransition as ReturnType<typeof vi.fn>;
const mockExtThrow = stripeExtensionHandlers["test.ext.throw"] as ReturnType<typeof vi.fn>;
const mockExtOk = stripeExtensionHandlers["test.ext.ok"] as ReturnType<typeof vi.fn>;

// The webhookEvents table sentinel for the dedup assertion (same identity the
// handler uses via markEventProcessed -> db.insert(webhookEvents)).
import { webhookEvents } from "@/db/schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHECKR_SECRET = "test_checkr_secret";
let eventIdCounter = 0;

function insertedTables() {
  return insertCalls.map((c) => c.table);
}
function webhookEventInserts() {
  return insertCalls.filter((c) => c.table === webhookEvents);
}

function checkrSig(body: string) {
  return crypto.createHmac("sha256", CHECKR_SECRET).update(body).digest("hex");
}

function checkrEvent(type: string, object: Record<string, unknown>) {
  eventIdCounter++;
  return { id: `chk_${eventIdCounter}`, type, data: { object } };
}

async function sendCheckr(
  event: { id: string; type: string; data: { object: Record<string, unknown> } },
  opts?: { signature?: string | null },
) {
  const body = JSON.stringify(event);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const sig = opts && "signature" in opts ? opts.signature : checkrSig(body);
  if (sig !== null && sig !== undefined) headers["x-checkr-signature"] = sig;
  return app.fetch(new Request("http://localhost/checkr", { method: "POST", headers, body }));
}

async function sendStripe(event: { id: string; type: string; data: { object: Record<string, unknown> } }) {
  mockConstructEvent.mockReturnValue(event);
  return app.fetch(
    new Request("http://localhost/stripe", {
      method: "POST",
      headers: { "Content-Type": "text/plain", "stripe-signature": "sig_test" },
      body: "raw-body",
    }),
  );
}

function stripeEvent(type: string, object: Record<string, unknown>) {
  eventIdCounter++;
  return { id: `evt_${eventIdCounter}`, type, data: { object } };
}

const STEP = {
  id: "step_1",
  providerId: "prov_1",
  status: "pending",
  stepType: "background_check",
  metadata: { checkrCandidateId: "cand_1" },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /checkr — FIX 2: mark-processed only after full pipeline (#138)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertCalls.length = 0;
    process.env.CHECKR_WEBHOOK_SECRET = CHECKR_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

    // Fresh leaf-mock implementations every test.
    mockWebhookEventsFindFirst.mockReset().mockResolvedValue(undefined);
    mockProvidersFindFirst.mockReset().mockResolvedValue(undefined);
    mockPaymentsFindFirst.mockReset().mockResolvedValue(undefined);
    mockSelectLimit.mockReset().mockResolvedValue([]);
    mockTxUpdateWhere.mockReset().mockResolvedValue(undefined);
    mockCheckAllSteps.mockReset().mockResolvedValue(undefined);
    mockExtThrow.mockReset();
    mockExtOk.mockReset().mockResolvedValue(undefined);
  });

  it("report.completed processing error -> 500, event NOT marked, retry re-applies", async () => {
    const event = checkrEvent("report.completed", { id: "rpt_1", candidate_id: "cand_1", status: "clear", adjudication: null });

    // ── Delivery 1: not yet processed, status-transition update throws ──
    mockWebhookEventsFindFirst.mockResolvedValueOnce(undefined);
    mockSelectLimit.mockResolvedValueOnce([{ ...STEP }]);
    // 1st tx.update (metadata backfill) succeeds; 2nd (status transition) throws.
    mockTxUpdateWhere.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("db write failed"));

    const res1 = await sendCheckr(event);
    expect(res1.status).toBe(500);
    // Dedup row must NOT be written -> Checkr will redeliver.
    expect(insertedTables()).not.toContain(webhookEvents);

    // ── Delivery 2 (retry): still unmarked, mutations now succeed ──
    insertCalls.length = 0;
    mockWebhookEventsFindFirst.mockResolvedValueOnce(undefined);
    mockSelectLimit.mockResolvedValueOnce([{ ...STEP }]);
    mockTxUpdateWhere.mockResolvedValue(undefined);
    mockProvidersFindFirst.mockResolvedValueOnce({ id: "prov_1", userId: "user_1" });

    const res2 = await sendCheckr(event);
    expect(res2.status).toBe(200);
    // Mutations re-applied (proves the first delivery never marked it).
    expect(txMock.update).toHaveBeenCalled();
    expect(webhookEventInserts().length).toBe(1);
  });

  it("atomicity: both tx updates are in the SAME rejected transaction, no dedup row", async () => {
    const event = checkrEvent("report.completed", { id: "rpt_a", candidate_id: "cand_1", status: "clear", adjudication: null });
    mockWebhookEventsFindFirst.mockResolvedValueOnce(undefined);
    mockSelectLimit.mockResolvedValueOnce([{ ...STEP }]);
    mockTxUpdateWhere.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("boom"));

    const res = await sendCheckr(event);
    expect(res.status).toBe(500);
    // Both updates ran via the SAME tx object (no separate db.update path).
    expect(txMock.update).toHaveBeenCalledTimes(2);
    expect(insertedTables()).not.toContain(webhookEvents);
  });

  it("report.completed success -> marked EXACTLY once, at the very end (after checkAllSteps)", async () => {
    const event = checkrEvent("report.completed", { id: "rpt_2", candidate_id: "cand_1", status: "clear", adjudication: null });
    mockWebhookEventsFindFirst.mockResolvedValueOnce(undefined);
    mockSelectLimit.mockResolvedValueOnce([{ ...STEP }]);
    mockProvidersFindFirst.mockResolvedValueOnce({ id: "prov_1", userId: "user_1" });

    const res = await sendCheckr(event);
    expect(res.status).toBe(200);

    const marks = webhookEventInserts();
    expect(marks.length).toBe(1);
    expect((marks[0].vals as { status: string }).status).toBe("processed");
    // newStepStatus === "complete" -> checkAllSteps runs, BEFORE the dedup mark.
    expect(mockCheckAllSteps).toHaveBeenCalledTimes(1);
    expect(mockCheckAllSteps.mock.invocationCallOrder[0]).toBeLessThan(
      mockDbInsert.mock.invocationCallOrder[0],
    );
  });

  it("redelivery (dedup hit) -> single step transition, checkAllSteps not double-fired", async () => {
    const event = checkrEvent("report.completed", { id: "rpt_3", candidate_id: "cand_1", status: "clear", adjudication: null });

    // Delivery 1 processes fully (and marks).
    mockWebhookEventsFindFirst.mockResolvedValueOnce(undefined);
    mockSelectLimit.mockResolvedValueOnce([{ ...STEP }]);
    mockProvidersFindFirst.mockResolvedValueOnce({ id: "prov_1", userId: "user_1" });
    const res1 = await sendCheckr(event);
    expect(res1.status).toBe(200);

    // Delivery 2: dedup lookup now returns the row -> short-circuits.
    mockWebhookEventsFindFirst.mockResolvedValueOnce({ id: event.id, source: "checkr" });
    const res2 = await sendCheckr(event);
    expect(res2.status).toBe(200);

    // Status transition + checkAllSteps happened exactly once across both deliveries.
    expect(txMock.update).toHaveBeenCalledTimes(2); // 2 updates in the ONE processed delivery
    expect(mockCheckAllSteps).toHaveBeenCalledTimes(1);
  });

  it("no-matching-step -> 503 and UNMARKED (so Checkr retries)", async () => {
    const event = checkrEvent("report.completed", { id: "rpt_4", candidate_id: "cand_missing", status: "clear", adjudication: null });
    mockWebhookEventsFindFirst.mockResolvedValueOnce(undefined);
    mockSelectLimit.mockResolvedValueOnce([]); // no matching onboarding step

    const res = await sendCheckr(event);
    expect(res.status).toBe(503);
    expect(insertedTables()).not.toContain(webhookEvents);
    expect(txMock.update).not.toHaveBeenCalled();
  });

  it("no-matching-step then later redelivery once a step exists -> processes and applies", async () => {
    const event = checkrEvent("report.completed", { id: "rpt_5", candidate_id: "cand_1", status: "clear", adjudication: null });

    // Delivery 1: step not present yet -> 503, unmarked.
    mockWebhookEventsFindFirst.mockResolvedValueOnce(undefined);
    mockSelectLimit.mockResolvedValueOnce([]);
    const res1 = await sendCheckr(event);
    expect(res1.status).toBe(503);
    expect(insertedTables()).not.toContain(webhookEvents);

    // Delivery 2: still unmarked, step now exists -> processes + marks.
    insertCalls.length = 0;
    mockWebhookEventsFindFirst.mockResolvedValueOnce(undefined);
    mockSelectLimit.mockResolvedValueOnce([{ ...STEP }]);
    mockProvidersFindFirst.mockResolvedValueOnce({ id: "prov_1", userId: "user_1" });
    const res2 = await sendCheckr(event);
    expect(res2.status).toBe(200);
    expect(webhookEventInserts().length).toBe(1);
  });

  it("non-report.completed Checkr event falls through and IS marked 'processed'", async () => {
    const event = checkrEvent("report.created", { id: "rpt_6", candidate_id: "cand_1" });
    mockWebhookEventsFindFirst.mockResolvedValueOnce(undefined);

    const res = await sendCheckr(event);
    expect(res.status).toBe(200);
    expect(txMock.update).not.toHaveBeenCalled();
    const marks = webhookEventInserts();
    expect(marks.length).toBe(1);
    expect((marks[0].vals as { status: string }).status).toBe("processed");
  });

  it("rejects an invalid Checkr signature with 401 (no processing)", async () => {
    const event = checkrEvent("report.completed", { id: "rpt_7", candidate_id: "cand_1", status: "clear" });
    const res = await sendCheckr(event, { signature: "deadbeef" });
    expect(res.status).toBe(401);
    expect(insertedTables()).not.toContain(webhookEvents);
  });
});

describe("POST /stripe — FIX 3: extension dispatch is fail-closed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertCalls.length = 0;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mockWebhookEventsFindFirst.mockReset().mockResolvedValue(undefined);
    mockPaymentsFindFirst.mockReset().mockResolvedValue(undefined);
    mockExtThrow.mockReset();
    mockExtOk.mockReset().mockResolvedValue(undefined);
  });

  it("throwing handler -> 500, dedup NOT written, money-integrity ops alert emitted", async () => {
    mockWebhookEventsFindFirst.mockResolvedValueOnce(undefined);
    mockExtThrow.mockRejectedValueOnce(new Error("handler exploded"));

    const res = await sendStripe(stripeEvent("test.ext.throw", { id: "obj_1" }));
    expect(res.status).toBe(500);
    // Dedup row must never be written when a handler throws.
    expect(insertedTables()).not.toContain(webhookEvents);
    // Observability: ops alert (#51) emitted on the throw path.
    expect(mockSendOpsAlert).toHaveBeenCalledTimes(1);
    expect(mockSendOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: "critical",
        fields: expect.objectContaining({ eventType: "test.ext.throw" }),
      }),
    );
  });

  it("registered handler success -> dedup written with status 'processed'", async () => {
    mockWebhookEventsFindFirst.mockResolvedValueOnce(undefined);

    const res = await sendStripe(stripeEvent("test.ext.ok", { id: "obj_2" }));
    expect(res.status).toBe(200);
    expect(mockExtOk).toHaveBeenCalledTimes(1);
    expect(mockSendOpsAlert).not.toHaveBeenCalled();
    const marks = webhookEventInserts();
    expect(marks.length).toBe(1);
    expect((marks[0].vals as { status: string }).status).toBe("processed");
  });

  it("unregistered event type -> dedup written with status 'skipped'", async () => {
    mockWebhookEventsFindFirst.mockResolvedValueOnce(undefined);

    const res = await sendStripe(stripeEvent("customer.source.created", { id: "src_1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    const marks = webhookEventInserts();
    expect(marks.length).toBe(1);
    expect((marks[0].vals as { status: string }).status).toBe("skipped");
  });
});

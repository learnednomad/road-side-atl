import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the modules under test
//
// These tests exercise the Stripe extension handlers DIRECTLY (not via the
// Hono route) so the DB mock is the SOLE controllable throw source. The whole
// point of FIX-1 is fail-CLOSED behavior: an UNEXPECTED DB error must PROPAGATE
// out of the handler so the caller never marks the event processed (Stripe then
// retries). A benign unique-violation (23505) is the only swallowed case.
// ---------------------------------------------------------------------------

vi.mock("@/db", () => ({
  db: {
    // Configured per-test. transaction PROPAGATES rejections (a thrown callback
    // rejects the outer promise — exactly how a real aborted PG tx behaves).
    transaction: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    query: {
      memberships: { findFirst: vi.fn() },
    },
  },
}));

// drizzle-orm operators — passthroughs so they don't break at import time.
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ _op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ _op: "and", args })),
}));

vi.mock("@/db/schema", () => ({
  b2bAccounts: { id: "id", currentBalanceCents: "currentBalanceCents" },
  b2bCreditTransactions: { id: "id", invoiceId: "invoiceId", type: "type" },
  memberships: { id: "id", stripeSubscriptionId: "stripeSubscriptionId" },
}));

// Ops alerts — spy so we can assert the money-integrity (#51) emission on the
// !acct anomaly without doing any network I/O.
vi.mock("@/server/api/lib/ops-alerts", () => ({
  sendOpsAlert: vi.fn(),
}));

// Novu — fire-and-forget; default to a resolved no-op so void triggerNovu(...)
// never affects control flow. Tests can override to reject and prove it is
// NEVER on the throw/500 path.
vi.mock("@/lib/notifications/novu", () => ({
  triggerNovu: vi.fn().mockResolvedValue(undefined),
  WF: {
    membershipActivated: "membership-activated",
    membershipPastDue: "membership-past-due",
    membershipCanceled: "membership-canceled",
  },
  custSub: (userId: string) => userId,
}));

// ---------------------------------------------------------------------------
// Imports under test + mocked references
// ---------------------------------------------------------------------------

import { db } from "@/db";
import { memberships } from "@/db/schema";
import { sendOpsAlert } from "@/server/api/lib/ops-alerts";
import { triggerNovu } from "@/lib/notifications/novu";
import { handleInvoicePaid } from "@/server/api/lib/webhook-handlers/invoice-paid";
import {
  handleSubscriptionUpsert,
  handleSubscriptionDeleted,
} from "@/server/api/lib/webhook-handlers/subscription";

const mockTransaction = db.transaction as ReturnType<typeof vi.fn>;
const mockDbInsert = db.insert as ReturnType<typeof vi.fn>;
const mockDbUpdate = db.update as ReturnType<typeof vi.fn>;
const mockSendOpsAlert = sendOpsAlert as ReturnType<typeof vi.fn>;
const mockTriggerNovu = triggerNovu as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a chainable tx mock mirroring the real handler shape:
 *   tx.select().from().where().for("update")   -> acct lookup (FOR UPDATE)
 *   tx.select().from().where().limit(1)        -> existing-payment guard
 *   tx.insert().values()                       -> ledger insert
 *   tx.update().set().where()                  -> balance decrement
 * Select terminals are queueable via mockResolvedValue(Once).
 */
function makeTx(opts?: {
  acct?: unknown[];
  existing?: unknown[];
  insertError?: unknown;
  updateError?: unknown;
}) {
  const forFn = vi.fn().mockResolvedValue(opts?.acct ?? [{ balance: 10000 }]);
  const limitFn = vi.fn().mockResolvedValue(opts?.existing ?? []);
  const whereSel = vi.fn(() => ({ for: forFn, limit: limitFn }));
  const fromSel = vi.fn(() => ({ where: whereSel }));
  const select = vi.fn(() => ({ from: fromSel }));

  const insertValues = opts?.insertError
    ? vi.fn().mockRejectedValue(opts.insertError)
    : vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn(() => ({ values: insertValues }));

  const updateWhere = opts?.updateError
    ? vi.fn().mockRejectedValue(opts.updateError)
    : vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  const tx = { select, insert, update };
  return { tx, forFn, limitFn, insert, insertValues, update, updateSet, updateWhere };
}

/** Wire db.transaction to run the callback with the given tx, propagating throws. */
function wireTransaction(tx: unknown) {
  mockTransaction.mockImplementation(
    async (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
  );
  return tx;
}

function invoiceEvent(object: Record<string, unknown>) {
  return { id: "evt_inv", type: "invoice.paid", data: { object } } as never;
}

function subEvent(type: string, object: Record<string, unknown>) {
  return { id: "evt_sub", type, data: { object } } as never;
}

// ---------------------------------------------------------------------------
// invoice.paid (handleInvoicePaid) — B2B NET credit paydown
// ---------------------------------------------------------------------------

describe("handleInvoicePaid — fail-closed B2B credit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("not a B2B invoice (!accountId/!amount) -> no tx opened, no ops alert", async () => {
    await handleInvoicePaid(invoiceEvent({ id: "in_1", metadata: {}, amount_paid: 5000 }));
    await handleInvoicePaid(invoiceEvent({ id: "in_2", metadata: { b2bAccountId: "acct_1" }, amount_paid: 0 }));
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockSendOpsAlert).not.toHaveBeenCalled();
  });

  it("happy path -> ledger insert amountCents === -amount_paid and balance decremented", async () => {
    const m = makeTx({ acct: [{ balance: 10000 }], existing: [] });
    wireTransaction(m.tx);

    await handleInvoicePaid(
      invoiceEvent({ id: "in_happy", metadata: { b2bAccountId: "acct_1" }, amount_paid: 3000 }),
    );

    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acct_1",
        type: "payment",
        amountCents: -3000,
        invoiceId: "in_happy",
      }),
    );
    expect(m.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ currentBalanceCents: 10000 - 3000 }),
    );
    expect(mockSendOpsAlert).not.toHaveBeenCalled();
  });

  it("missing account row (!acct) -> no-op, no ledger write, AND money-integrity ops alert (#51) emitted", async () => {
    const m = makeTx({ acct: [] });
    wireTransaction(m.tx);

    await expect(
      handleInvoicePaid(invoiceEvent({ id: "in_noacct", metadata: { b2bAccountId: "ghost" }, amount_paid: 2000 })),
    ).resolves.toBeUndefined();

    expect(m.insertValues).not.toHaveBeenCalled();
    expect(m.updateSet).not.toHaveBeenCalled();
    expect(mockSendOpsAlert).toHaveBeenCalledTimes(1);
    expect(mockSendOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: "critical",
        fields: expect.objectContaining({ b2bAccountId: "ghost", invoiceId: "in_noacct" }),
      }),
    );
  });

  it("redelivery with existing payment -> silent no-op (no double credit, no balance change)", async () => {
    const m = makeTx({ acct: [{ balance: 10000 }], existing: [{ id: "txn_prev" }] });
    wireTransaction(m.tx);

    await handleInvoicePaid(
      invoiceEvent({ id: "in_dup", metadata: { b2bAccountId: "acct_1" }, amount_paid: 3000 }),
    );

    expect(m.insertValues).not.toHaveBeenCalled();
    expect(m.updateSet).not.toHaveBeenCalled();
    expect(mockSendOpsAlert).not.toHaveBeenCalled();
  });

  it("unique-violation (23505) on the ledger insert -> swallowed as benign duplicate, no throw", async () => {
    const m = makeTx({ acct: [{ balance: 10000 }], existing: [], insertError: { code: "23505" } });
    wireTransaction(m.tx);

    await expect(
      handleInvoicePaid(invoiceEvent({ id: "in_uv", metadata: { b2bAccountId: "acct_1" }, amount_paid: 3000 })),
    ).resolves.toBeUndefined();
  });

  it("transient/unexpected DB error (code != 23505) -> handler THROWS so caller will NOT mark processed", async () => {
    const m = makeTx({ acct: [{ balance: 10000 }], existing: [], updateError: { code: "40001" } });
    wireTransaction(m.tx);

    await expect(
      handleInvoicePaid(invoiceEvent({ id: "in_err", metadata: { b2bAccountId: "acct_1" }, amount_paid: 3000 })),
    ).rejects.toMatchObject({ code: "40001" });
  });
});

// ---------------------------------------------------------------------------
// customer.subscription.* (handleSubscriptionUpsert / Deleted) — memberships
// ---------------------------------------------------------------------------

describe("handleSubscriptionUpsert — fail-closed membership upsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function wireUpsert(error?: unknown) {
    const onConflictDoUpdate = error
      ? vi.fn().mockRejectedValue(error)
      : vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    mockDbInsert.mockReturnValue({ values });
    return { values, onConflictDoUpdate };
  }

  it("not a membership subscription (!userId/!planId) -> no insert", async () => {
    wireUpsert();
    await handleSubscriptionUpsert(subEvent("customer.subscription.created", { id: "sub_x", metadata: {}, status: "active" }));
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("happy upsert -> onConflictDoUpdate called once; triggerNovu fired with stable transactionId", async () => {
    const { values, onConflictDoUpdate } = wireUpsert();

    await handleSubscriptionUpsert(
      subEvent("customer.subscription.created", {
        id: "sub_1",
        status: "active",
        metadata: { userId: "u1", planId: "p1", planName: "Pro" },
      }),
    );

    expect(mockDbInsert).toHaveBeenCalledWith(memberships);
    expect(values).toHaveBeenCalledTimes(1);
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: memberships.stripeSubscriptionId,
        set: expect.objectContaining({ status: "active", planId: "p1" }),
      }),
    );
    // fire-and-forget Inbox mirror with idempotent transactionId
    expect(mockTriggerNovu).toHaveBeenCalledWith(
      "membership-activated",
      "u1",
      expect.objectContaining({ planName: "Pro" }),
      { transactionId: "sub_1:active" },
    );
  });

  it("redelivery is a no-op via onConflictDoUpdate (idempotent, never a second distinct write)", async () => {
    const { values, onConflictDoUpdate } = wireUpsert();
    const ev = subEvent("customer.subscription.updated", {
      id: "sub_redeliver",
      status: "active",
      metadata: { userId: "u1", planId: "p1" },
    });

    await handleSubscriptionUpsert(ev);
    await handleSubscriptionUpsert(ev);

    // Each delivery issues exactly one onConflict upsert — the second resolves
    // to the same row, never a double application.
    expect(values).toHaveBeenCalledTimes(2);
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(2);
  });

  it("unexpected DB error -> THROWS (fail-closed); triggerNovu is NOT the throw source", async () => {
    wireUpsert({ code: "40001" });

    await expect(
      handleSubscriptionUpsert(
        subEvent("customer.subscription.updated", {
          id: "sub_err",
          status: "active",
          metadata: { userId: "u1", planId: "p1" },
        }),
      ),
    ).rejects.toMatchObject({ code: "40001" });
    // it never got to the notification because the upsert threw
    expect(mockTriggerNovu).not.toHaveBeenCalled();
  });

  it("a rejecting triggerNovu does NOT propagate (notifications are off the 500 path)", async () => {
    wireUpsert();
    mockTriggerNovu.mockRejectedValueOnce(new Error("novu down"));

    await expect(
      handleSubscriptionUpsert(
        subEvent("customer.subscription.created", {
          id: "sub_novu",
          status: "active",
          metadata: { userId: "u1", planId: "p1" },
        }),
      ),
    ).resolves.toBeUndefined();
  });
});

describe("handleSubscriptionDeleted — fail-closed cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function wireDelete(error?: unknown) {
    const where = error ? vi.fn().mockRejectedValue(error) : vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where }));
    mockDbUpdate.mockReturnValue({ set });
    return { set, where };
  }

  it("happy delete -> keyed update + canceled Novu with stable transactionId", async () => {
    const { set } = wireDelete();

    await handleSubscriptionDeleted(
      subEvent("customer.subscription.deleted", { id: "sub_del", metadata: { userId: "u1", planName: "Pro" } }),
    );

    expect(mockDbUpdate).toHaveBeenCalledWith(memberships);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "canceled" }));
    expect(mockTriggerNovu).toHaveBeenCalledWith(
      "membership-canceled",
      "u1",
      expect.objectContaining({ planName: "Pro" }),
      { transactionId: "sub_del:canceled" },
    );
  });

  it("unexpected DB error -> THROWS (fail-closed, no dedup mark by caller)", async () => {
    wireDelete({ code: "40001" });

    await expect(
      handleSubscriptionDeleted(
        subEvent("customer.subscription.deleted", { id: "sub_del_err", metadata: { userId: "u1" } }),
      ),
    ).rejects.toMatchObject({ code: "40001" });
  });
});

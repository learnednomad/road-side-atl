import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock("@/db", () => ({
  db: {
    query: {
      payments: { findFirst: vi.fn() },
    },
    update: vi.fn(),
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}));

vi.mock("@/server/api/lib/payout-calculator", () => ({
  createPayoutIfEligible: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/server/api/lib/audit-logger", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

// drizzle-orm operators used inside the handler — provide passthroughs so
// they don't break at import time but we can still assert against mock calls.
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ _op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ _op: "and", args })),
}));

vi.mock("@/db/schema", () => ({
  payments: {
    stripeSessionId: "stripeSessionId",
    stripePaymentIntentId: "stripePaymentIntentId",
    id: "id",
    status: "status",
    bookingId: "bookingId",
    method: "method",
  },
  bookings: { id: "id" },
}));

// ---------------------------------------------------------------------------
// Import modules under test + mocked references
// ---------------------------------------------------------------------------

import { db } from "@/db";
import { stripe } from "@/lib/stripe";
import { createPayoutIfEligible } from "@/server/api/lib/payout-calculator";
import { logAudit } from "@/server/api/lib/audit-logger";
import app from "@/server/api/routes/webhooks";

// Typed mock references for clarity
const mockConstructEvent = stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>;
const mockPaymentsFindFirst = db.query.payments.findFirst as ReturnType<typeof vi.fn>;
const mockDbUpdate = db.update as ReturnType<typeof vi.fn>;
const mockCreatePayoutIfEligible = createPayoutIfEligible as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Use a global counter that never resets to avoid event ID collisions with
// the module-level processedEvents Set that persists across tests.
let eventIdCounter = 0;

/**
 * Sets up the db.update mock so that db.update(table).set(data).where(cond)
 * returns a resolved promise. Each call returns a fresh chain so assertions
 * can inspect individual invocations.
 */
function setupUpdateChain() {
  const whereFn = vi.fn().mockResolvedValue(undefined);
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  mockDbUpdate.mockReturnValue({ set: setFn });
  return { setFn, whereFn };
}

/**
 * Convenience to send a POST /stripe request through the Hono app.
 */
async function sendWebhook(opts?: { signature?: string | null; body?: string }) {
  const headers: Record<string, string> = { "Content-Type": "text/plain" };
  if (opts?.signature !== null) {
    headers["stripe-signature"] = opts?.signature ?? "sig_test";
  }
  const req = new Request("http://localhost/stripe", {
    method: "POST",
    headers,
    body: opts?.body ?? "raw-body",
  });
  return app.fetch(req);
}

function stripeEvent(type: string, object: Record<string, unknown>) {
  eventIdCounter++;
  return { id: `evt_test_${eventIdCounter}`, type, data: { object } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /stripe — Stripe Webhook Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
  });

  // -----------------------------------------------------------------------
  // 1. Missing stripe-signature header
  // -----------------------------------------------------------------------
  it("returns 400 when stripe-signature header is missing", async () => {
    const res = await sendWebhook({ signature: null });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Missing signature");
  });

  // -----------------------------------------------------------------------
  // 2. Missing STRIPE_WEBHOOK_SECRET env var
  // -----------------------------------------------------------------------
  it("returns 500 when STRIPE_WEBHOOK_SECRET env var is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await sendWebhook();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Webhook not configured");
  });

  // -----------------------------------------------------------------------
  // 3. Signature verification failure
  // -----------------------------------------------------------------------
  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const res = await sendWebhook();
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid signature");
  });

  // -----------------------------------------------------------------------
  // 4. Event ID deduplication
  // -----------------------------------------------------------------------
  it("returns deduplicated response for already-processed event ID", async () => {
    const event = stripeEvent("checkout.session.completed", {
      id: "cs_dedup",
      metadata: { bookingId: "b-dedup" },
      payment_intent: "pi_dedup",
      amount_total: 1000,
    });
    mockConstructEvent.mockReturnValue(event);
    mockPaymentsFindFirst.mockResolvedValue(undefined);

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    mockDbUpdate.mockReturnValue({ set: setFn });

    // First call — processes normally
    const res1 = await sendWebhook();
    expect(res1.status).toBe(200);

    // Second call with same event — should be deduplicated
    const res2 = await sendWebhook();
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.deduplicated).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 5. checkout.session.completed — confirms payment, stores PaymentIntent ID
  // -----------------------------------------------------------------------
  describe("checkout.session.completed", () => {
    it("confirms payment and stores PaymentIntent ID", async () => {
      const event = stripeEvent("checkout.session.completed", {
        id: "cs_123",
        metadata: { bookingId: "b-1" },
        payment_intent: "pi_abc",
        amount_total: 5000,
      });
      mockConstructEvent.mockReturnValue(event);
      // No existing confirmed payment (idempotency check)
      mockPaymentsFindFirst.mockResolvedValue(undefined);

      // First db.update call: update payments
      const chain1 = setupUpdateChain();
      // Second db.update call: update bookings
      const chain2Where = vi.fn().mockResolvedValue(undefined);
      const chain2Set = vi.fn().mockReturnValue({ where: chain2Where });

      // db.update is called twice — once for payments, once for bookings.
      // Return fresh chain objects on successive calls.
      mockDbUpdate
        .mockReturnValueOnce({ set: chain1.setFn })
        .mockReturnValueOnce({ set: chain2Set });

      const res = await sendWebhook();
      expect(res.status).toBe(200);

      // Payment update: status confirmed + stripePaymentIntentId
      expect(chain1.setFn).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "confirmed",
          stripePaymentIntentId: "pi_abc",
        })
      );

      // Booking update: finalPrice from amount_total
      expect(chain2Set).toHaveBeenCalledWith(
        expect.objectContaining({ finalPrice: 5000 })
      );
    });

    // -------------------------------------------------------------------
    // 6. Idempotency — skip if already confirmed
    // -------------------------------------------------------------------
    it("skips if already confirmed (idempotency)", async () => {
      const event = stripeEvent("checkout.session.completed", {
        id: "cs_123",
        metadata: { bookingId: "b-1" },
        payment_intent: "pi_abc",
        amount_total: 5000,
      });
      mockConstructEvent.mockReturnValue(event);
      // Existing confirmed payment found
      mockPaymentsFindFirst.mockResolvedValue({
        id: "pay-1",
        status: "confirmed",
        stripeSessionId: "cs_123",
      });

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      // db.update should NOT have been called
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------
    // 7. Calls createPayoutIfEligible
    // -------------------------------------------------------------------
    it("calls createPayoutIfEligible after confirming payment", async () => {
      const event = stripeEvent("checkout.session.completed", {
        id: "cs_456",
        metadata: { bookingId: "b-2" },
        payment_intent: "pi_def",
        amount_total: 8000,
      });
      mockConstructEvent.mockReturnValue(event);
      mockPaymentsFindFirst.mockResolvedValue(undefined);

      // Two db.update calls (payments + bookings)
      const whereFn = vi.fn().mockResolvedValue(undefined);
      const setFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDbUpdate.mockReturnValue({ set: setFn });

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(mockCreatePayoutIfEligible).toHaveBeenCalledWith("b-2");
    });
  });

  // -----------------------------------------------------------------------
  // 8-10. charge.refunded
  // -----------------------------------------------------------------------
  describe("charge.refunded", () => {
    it("updates payment to refunded with refund amount", async () => {
      const event = stripeEvent("charge.refunded", {
        id: "ch_123",
        payment_intent: "pi_refund",
        amount_refunded: 5000,
        metadata: { bookingId: "b-10" },
      });
      mockConstructEvent.mockReturnValue(event);
      mockPaymentsFindFirst.mockResolvedValue({
        id: "pay-10",
        bookingId: "b-10",
        amount: 5000,
        status: "confirmed",
        stripePaymentIntentId: "pi_refund",
      });

      const { setFn } = setupUpdateChain();

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(setFn).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "refunded",
          refundAmount: 5000,
        })
      );
      // refundedAt should be a Date
      const setCall = setFn.mock.calls[0][0];
      expect(setCall.refundedAt).toBeInstanceOf(Date);
    });

    it("skips if already refunded (idempotency)", async () => {
      const event = stripeEvent("charge.refunded", {
        id: "ch_124",
        payment_intent: "pi_already_ref",
        metadata: {},
      });
      mockConstructEvent.mockReturnValue(event);
      mockPaymentsFindFirst.mockResolvedValue({
        id: "pay-11",
        bookingId: "b-11",
        status: "refunded",
        stripePaymentIntentId: "pi_already_ref",
      });

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it("warns when no payment found for PaymentIntent", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const event = stripeEvent("charge.refunded", {
        id: "ch_125",
        payment_intent: "pi_orphan",
        metadata: {},
      });
      mockConstructEvent.mockReturnValue(event);
      mockPaymentsFindFirst.mockResolvedValue(undefined);

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("charge.refunded: no payment found")
      );
      expect(mockDbUpdate).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // 11-12. checkout.session.expired
  // -----------------------------------------------------------------------
  describe("checkout.session.expired", () => {
    it("marks pending payment as failed", async () => {
      const event = stripeEvent("checkout.session.expired", {
        id: "cs_expired",
      });
      mockConstructEvent.mockReturnValue(event);

      const { setFn } = setupUpdateChain();

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(setFn).toHaveBeenCalledWith({ status: "failed" });
    });

    it("skips non-pending payments because WHERE clause restricts to pending", async () => {
      const event = stripeEvent("checkout.session.expired", {
        id: "cs_expired_2",
      });
      mockConstructEvent.mockReturnValue(event);

      const { setFn, whereFn } = setupUpdateChain();

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(setFn).toHaveBeenCalledWith({ status: "failed" });
      // WHERE is called — the idempotency is enforced by the AND eq(status, "pending")
      expect(whereFn).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 13. charge.dispute.created
  // -----------------------------------------------------------------------
  describe("charge.dispute.created", () => {
    it("sets status to disputed and updates booking notes", async () => {
      const event = stripeEvent("charge.dispute.created", {
        id: "dp_001",
        charge: "ch_500",
        payment_intent: "pi_dispute",
        reason: "fraudulent",
        amount: 5000,
        currency: "usd",
        status: "needs_response",
        metadata: { bookingId: "b-20" },
      });
      mockConstructEvent.mockReturnValue(event);
      mockPaymentsFindFirst.mockResolvedValue({
        id: "pay-20",
        bookingId: "b-20",
        status: "confirmed",
        stripePaymentIntentId: "pi_dispute",
      });

      // Two db.update calls: payments (set disputed) + bookings (notes)
      const paymentsWhere = vi.fn().mockResolvedValue(undefined);
      const paymentsSet = vi.fn().mockReturnValue({ where: paymentsWhere });
      const bookingsWhere = vi.fn().mockResolvedValue(undefined);
      const bookingsSet = vi.fn().mockReturnValue({ where: bookingsWhere });

      mockDbUpdate
        .mockReturnValueOnce({ set: paymentsSet })
        .mockReturnValueOnce({ set: bookingsSet });

      const res = await sendWebhook();
      expect(res.status).toBe(200);

      // Payment set to "disputed"
      expect(paymentsSet).toHaveBeenCalledWith({ status: "disputed" });

      // Booking notes updated with dispute info
      expect(bookingsSet).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: expect.stringContaining("[DISPUTE] fraudulent"),
        })
      );
      expect(bookingsSet).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: expect.stringContaining("dp_001"),
        })
      );

      // Audit logged
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "payment.dispute",
          resourceType: "dispute",
          resourceId: "dp_001",
          details: expect.objectContaining({
            reason: "fraudulent",
            amount: 5000,
          }),
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // 14-15. charge.dispute.updated — won / lost
  // -----------------------------------------------------------------------
  describe("charge.dispute.updated", () => {
    it("restores to confirmed and updates booking notes when dispute is won", async () => {
      const event = stripeEvent("charge.dispute.updated", {
        id: "dp_002",
        payment_intent: "pi_dispute_won",
        reason: "fraudulent",
        amount: 3000,
        status: "won",
        metadata: { bookingId: "b-30" },
      });
      mockConstructEvent.mockReturnValue(event);
      mockPaymentsFindFirst.mockResolvedValue({
        id: "pay-30",
        bookingId: "b-30",
        status: "disputed",
        stripePaymentIntentId: "pi_dispute_won",
      });

      // Two db.update calls: payments (confirmed) + bookings (notes)
      const paymentsWhere = vi.fn().mockResolvedValue(undefined);
      const paymentsSet = vi.fn().mockReturnValue({ where: paymentsWhere });
      const bookingsWhere = vi.fn().mockResolvedValue(undefined);
      const bookingsSet = vi.fn().mockReturnValue({ where: bookingsWhere });

      mockDbUpdate
        .mockReturnValueOnce({ set: paymentsSet })
        .mockReturnValueOnce({ set: bookingsSet });

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(paymentsSet).toHaveBeenCalledWith({ status: "confirmed" });
      expect(bookingsSet).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: expect.stringContaining("[DISPUTE WON]"),
        })
      );

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "payment.dispute",
          resourceType: "dispute",
          resourceId: "dp_002",
          details: expect.objectContaining({ status: "won" }),
        })
      );
    });

    it("sets refunded with details when dispute is lost", async () => {
      const event = stripeEvent("charge.dispute.updated", {
        id: "dp_003",
        payment_intent: "pi_dispute_lost",
        reason: "product_not_received",
        amount: 7500,
        status: "lost",
        metadata: { bookingId: "b-31" },
      });
      mockConstructEvent.mockReturnValue(event);
      mockPaymentsFindFirst.mockResolvedValue({
        id: "pay-31",
        bookingId: "b-31",
        status: "disputed",
        stripePaymentIntentId: "pi_dispute_lost",
      });

      const { setFn } = setupUpdateChain();

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(setFn).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "refunded",
          refundAmount: 7500,
          refundReason: "Dispute lost: product_not_received",
        })
      );
      // refundedAt should be a Date
      const setCall = setFn.mock.calls[0][0];
      expect(setCall.refundedAt).toBeInstanceOf(Date);

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "payment.dispute",
          resourceType: "dispute",
          resourceId: "dp_003",
          details: expect.objectContaining({ status: "lost" }),
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // 16. payment_intent.payment_failed
  // -----------------------------------------------------------------------
  describe("payment_intent.payment_failed", () => {
    it("marks pending payment as failed and logs audit", async () => {
      const event = stripeEvent("payment_intent.payment_failed", {
        id: "pi_fail",
        last_payment_error: { message: "Card declined", code: "card_declined" },
        metadata: { bookingId: "b-40" },
      });
      mockConstructEvent.mockReturnValue(event);
      mockPaymentsFindFirst.mockResolvedValue({
        id: "pay-40",
        bookingId: "b-40",
        status: "pending",
        stripePaymentIntentId: "pi_fail",
      });

      const { setFn } = setupUpdateChain();

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(setFn).toHaveBeenCalledWith({ status: "failed" });

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "payment.confirm",
          resourceType: "payment_intent",
          resourceId: "pi_fail",
          details: expect.objectContaining({
            status: "failed",
            failureMessage: "Card declined",
            failureCode: "card_declined",
          }),
        })
      );
    });

    it("skips update if payment status is not pending", async () => {
      const event = stripeEvent("payment_intent.payment_failed", {
        id: "pi_fail_confirmed",
        last_payment_error: { message: "Card declined" },
        metadata: { bookingId: "b-41" },
      });
      mockConstructEvent.mockReturnValue(event);
      mockPaymentsFindFirst.mockResolvedValue({
        id: "pay-41",
        bookingId: "b-41",
        status: "confirmed", // not pending — should skip update
        stripePaymentIntentId: "pi_fail_confirmed",
      });

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      // Should NOT update since status is "confirmed", not "pending"
      expect(mockDbUpdate).not.toHaveBeenCalled();
      // Audit should still be logged
      expect(mockLogAudit).toHaveBeenCalled();
    });

    it("handles missing last_payment_error gracefully", async () => {
      const event = stripeEvent("payment_intent.payment_failed", {
        id: "pi_fail_no_err",
        metadata: {},
      });
      mockConstructEvent.mockReturnValue(event);
      mockPaymentsFindFirst.mockResolvedValue({
        id: "pay-42",
        bookingId: "b-42",
        status: "pending",
        stripePaymentIntentId: "pi_fail_no_err",
      });

      const { setFn } = setupUpdateChain();

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(setFn).toHaveBeenCalledWith({ status: "failed" });

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            failureMessage: "Unknown failure",
            failureCode: null,
          }),
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // 17. charge.dispute.funds_withdrawn — audit only
  // -----------------------------------------------------------------------
  describe("charge.dispute.funds_withdrawn", () => {
    it("logs audit event for funds withdrawal", async () => {
      const event = stripeEvent("charge.dispute.funds_withdrawn", {
        id: "dp_fw_001",
        payment_intent: "pi_fw",
        amount: 5000,
        currency: "usd",
      });
      mockConstructEvent.mockReturnValue(event);

      const res = await sendWebhook();
      expect(res.status).toBe(200);

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "payment.dispute",
          resourceType: "dispute",
          resourceId: "dp_fw_001",
          details: expect.objectContaining({
            event: "funds_withdrawn",
            amount: 5000,
            currency: "usd",
          }),
        })
      );
      // Should NOT update any DB records
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 18. charge.dispute.funds_reinstated — restores payment status
  // -----------------------------------------------------------------------
  describe("charge.dispute.funds_reinstated", () => {
    it("restores disputed payment to confirmed and logs audit", async () => {
      const event = stripeEvent("charge.dispute.funds_reinstated", {
        id: "dp_fr_001",
        payment_intent: "pi_fr",
        amount: 5000,
        currency: "usd",
        metadata: { bookingId: "b-fr" },
      });
      mockConstructEvent.mockReturnValue(event);
      mockPaymentsFindFirst.mockResolvedValue({
        id: "pay-fr",
        bookingId: "b-fr",
        status: "disputed",
        stripePaymentIntentId: "pi_fr",
      });

      const { setFn } = setupUpdateChain();

      const res = await sendWebhook();
      expect(res.status).toBe(200);

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "payment.dispute",
          resourceType: "dispute",
          details: expect.objectContaining({
            event: "funds_reinstated",
          }),
        })
      );

      expect(setFn).toHaveBeenCalledWith({ status: "confirmed" });
    });

    it("skips update if payment is not in disputed status", async () => {
      const event = stripeEvent("charge.dispute.funds_reinstated", {
        id: "dp_fr_002",
        payment_intent: "pi_fr2",
        amount: 3000,
        currency: "usd",
        metadata: { bookingId: "b-fr2" },
      });
      mockConstructEvent.mockReturnValue(event);
      mockPaymentsFindFirst.mockResolvedValue({
        id: "pay-fr2",
        bookingId: "b-fr2",
        status: "confirmed", // already confirmed, should skip
        stripePaymentIntentId: "pi_fr2",
      });

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Edge: unknown event type returns 200 (webhook ack)
  // -----------------------------------------------------------------------
  it("returns 200 for unhandled event types", async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent("customer.subscription.created", { id: "sub_1" })
    );
    const res = await sendWebhook();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
  });
});

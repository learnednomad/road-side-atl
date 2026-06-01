import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ───────────────────────────────────────────────────

const mockStripe = {
  transfers: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/stripe", () => ({
  stripe: mockStripe,
  getStripe: () => mockStripe,
}));

vi.mock("@/server/api/lib/audit-logger", () => ({
  logAudit: vi.fn(),
  getRequestInfo: vi.fn(() => ({ ipAddress: "127.0.0.1", userAgent: "test" })),
}));

vi.mock("@/server/websocket/broadcast", () => ({
  broadcastToAdmins: vi.fn(),
  broadcastToUser: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  notifyPayoutComplete: vi.fn().mockResolvedValue(undefined),
  notifyConnectDeadlineExpired: vi.fn().mockResolvedValue(undefined),
}));

// DB mock with chainable queries
let mockInsertReturnValues: unknown[][] = [];
let mockUpdateReturnValues: unknown[][] = [];

const createInsertChain = () => {
  const returning = vi.fn().mockImplementation(() =>
    Promise.resolve(mockInsertReturnValues.shift() || []),
  );
  const values = vi.fn().mockReturnValue({ returning });
  return { values, returning };
};

const createUpdateChain = () => {
  const returning = vi.fn().mockImplementation(() =>
    Promise.resolve(mockUpdateReturnValues.shift() || []),
  );
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  return { set, where, returning };
};

let insertChain = createInsertChain();
let updateChain = createUpdateChain();

let selectWhereResult: unknown[] = [];
const createSelectChain = () => {
  const where = vi.fn().mockImplementation(() => Promise.resolve(selectWhereResult));
  const fromFn = vi.fn().mockReturnValue({ where });
  return { from: fromFn, where };
};

let selectChain = createSelectChain();

vi.mock("@/db", () => ({
  db: {
    query: {
      bookings: { findFirst: vi.fn() },
      payments: { findFirst: vi.fn() },
      providers: { findFirst: vi.fn() },
      providerPayouts: { findFirst: vi.fn() },
      services: { findFirst: vi.fn() },
      onboardingSteps: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    insert: vi.fn().mockImplementation(() => ({ values: insertChain.values })),
    update: vi.fn().mockImplementation(() => ({ set: updateChain.set })),
    select: vi.fn().mockImplementation(() => {
      const where = vi.fn().mockImplementation(() => Promise.resolve(selectWhereResult));
      const fromFn = vi.fn().mockReturnValue({ where });
      return { from: fromFn, where };
    }),
    transaction: vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn({
      update: vi.fn().mockImplementation(() => ({ set: updateChain.set })),
      query: {
        payments: { findFirst: vi.fn() },
        providerPayouts: { findFirst: vi.fn() },
      },
      insert: vi.fn().mockImplementation(() => ({ values: insertChain.values })),
    })),
  },
}));

vi.mock("@/db/schema", () => ({
  bookings: { id: "id", serviceId: "serviceId", status: "status", providerId: "providerId" },
  payments: { bookingId: "bookingId", status: "status", stripePaymentIntentId: "stripePaymentIntentId", method: "method" },
  providers: { id: "id", stripeConnectAccountId: "stripeConnectAccountId", status: "status" },
  providerPayouts: { id: "id", providerId: "providerId", bookingId: "bookingId", status: "status", payoutMethod: "payoutMethod", payoutType: "payoutType", metadata: "metadata" },
  services: { id: "id" },
}));

vi.mock("@/db/schema/onboarding-steps", () => ({
  onboardingSteps: { providerId: "providerId", stepType: "stepType", status: "status" },
}));

vi.mock("@/db/schema/providers", () => ({
  providers: { id: "id", status: "status", stripeConnectAccountId: "stripeConnectAccountId" },
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual("drizzle-orm");
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => ({ _op: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ _op: "and", args })),
    inArray: vi.fn((...args: unknown[]) => ({ _op: "inArray", args })),
    isNull: vi.fn((...args: unknown[]) => ({ _op: "isNull", args })),
    lt: vi.fn((...args: unknown[]) => ({ _op: "lt", args })),
    sql: Object.assign(vi.fn(), { raw: vi.fn() }),
  };
});

vi.mock("@/server/api/lib/invoice-generator", () => ({
  createInvoiceForBooking: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/api/lib/onboarding-state-machine", () => ({
  isValidStepTransition: vi.fn().mockReturnValue(true),
  isValidProviderTransition: vi.fn().mockReturnValue(true),
}));

vi.mock("@/server/api/lib/checkr", () => ({
  getReport: vi.fn(),
  CheckrApiError: class extends Error {},
}));

// ── Imports ──────────────────────────────────────────────────────

import { db } from "@/db";
import { logAudit } from "@/server/api/lib/audit-logger";

// ── Tests ────────────────────────────────────────────────────────

describe("Payout Routing", () => {
  const mockBooking = {
    id: "booking-1",
    status: "completed",
    providerId: "provider-1",
    serviceId: "service-1",
    priceOverrideCents: null,
  };

  const mockPayment = {
    id: "payment-1",
    bookingId: "booking-1",
    status: "confirmed",
    amount: 10000,
  };

  const mockProvider = {
    id: "provider-1",
    userId: "user-1",
    name: "Test Provider",
    commissionType: "percentage",
    commissionRate: 7000,
    flatFeeAmount: null,
    stripeConnectAccountId: "acct_test123",
  };

  const mockProviderNoConnect = {
    ...mockProvider,
    stripeConnectAccountId: null,
  };

  const mockService = {
    id: "service-1",
    commissionRate: 2500,
  };

  const mockStripeStep = {
    id: "step-1",
    providerId: "provider-1",
    stepType: "stripe_connect",
    status: "complete",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertReturnValues = [];
    mockUpdateReturnValues = [];
    insertChain = createInsertChain();
    updateChain = createUpdateChain();
    selectWhereResult = [];
    selectChain = createSelectChain();
    (db.insert as ReturnType<typeof vi.fn>).mockImplementation(() => ({ values: insertChain.values }));
    (db.update as ReturnType<typeof vi.fn>).mockImplementation(() => ({ set: updateChain.set }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => selectChain);
  });

  describe("createPayoutIfEligible - Stripe Connect routing", () => {
    it("routes via Stripe Connect for eligible provider", async () => {
      (db.query.bookings.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockBooking);
      (db.query.payments.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPayment);
      (db.query.providerPayouts.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockProvider);
      (db.query.services.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockService);
      (db.query.onboardingSteps.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockStripeStep);

      mockInsertReturnValues.push([{ id: "payout-1", providerId: "provider-1", amount: 7500 }]);
      mockStripe.transfers.create.mockResolvedValue({ id: "tr_test123" });

      const { createPayoutIfEligible } = await import("@/server/api/lib/payout-calculator");
      await createPayoutIfEligible("booking-1");

      expect(mockStripe.transfers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: "usd",
          destination: "acct_test123",
          transfer_group: "booking-1",
        }),
      );

      // Should update payout to paid + stripe_connect
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "paid",
          payoutMethod: "stripe_connect",
        }),
      );

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "payout.stripe_connect_transfer" }),
      );
    });

    it("creates manual_batch payout for non-Connect provider", async () => {
      (db.query.bookings.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockBooking);
      (db.query.payments.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPayment);
      (db.query.providerPayouts.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockProviderNoConnect);
      (db.query.services.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockService);
      (db.query.onboardingSteps.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      mockInsertReturnValues.push([{ id: "payout-1", providerId: "provider-1", amount: 7500 }]);

      const { createPayoutIfEligible } = await import("@/server/api/lib/payout-calculator");
      await createPayoutIfEligible("booking-1");

      expect(mockStripe.transfers.create).not.toHaveBeenCalled();
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ payoutMethod: "manual_batch" }),
      );
    });

    it("falls back to manual_batch on Stripe API failure", async () => {
      (db.query.bookings.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockBooking);
      (db.query.payments.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPayment);
      (db.query.providerPayouts.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockProvider);
      (db.query.services.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockService);
      (db.query.onboardingSteps.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockStripeStep);

      mockInsertReturnValues.push([{ id: "payout-1", providerId: "provider-1", amount: 7500 }]);
      mockStripe.transfers.create.mockRejectedValue(new Error("Insufficient balance"));

      const { createPayoutIfEligible } = await import("@/server/api/lib/payout-calculator");
      const result = await createPayoutIfEligible("booking-1");

      expect(result).toBeTruthy();
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          payoutMethod: "manual_batch",
          metadata: expect.objectContaining({ stripeError: "Insufficient balance" }),
        }),
      );
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "payout.stripe_connect_failed" }),
      );
    });

    it("sets transfer_group to bookingId for traceability", async () => {
      (db.query.bookings.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockBooking);
      (db.query.payments.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPayment);
      (db.query.providerPayouts.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockProvider);
      (db.query.services.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockService);
      (db.query.onboardingSteps.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockStripeStep);

      mockInsertReturnValues.push([{ id: "payout-1", providerId: "provider-1", amount: 7500 }]);
      mockStripe.transfers.create.mockResolvedValue({ id: "tr_test" });

      const { createPayoutIfEligible } = await import("@/server/api/lib/payout-calculator");
      await createPayoutIfEligible("booking-1");

      expect(mockStripe.transfers.create).toHaveBeenCalledWith(
        expect.objectContaining({ transfer_group: "booking-1" }),
      );
    });
  });

  describe("migratePendingPayoutsToConnect", () => {
    it("migrates pending manual payouts to Stripe Connect", async () => {
      (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockProvider);
      selectWhereResult = [
        { id: "payout-1", amount: 5000, bookingId: "booking-1", providerId: "provider-1", status: "pending", payoutMethod: "manual_batch" },
        { id: "payout-2", amount: 3000, bookingId: "booking-2", providerId: "provider-1", status: "pending", payoutMethod: "manual_batch" },
      ];

      // Claim update returns the payout (2 claims), then paid updates (2 paid updates)
      mockUpdateReturnValues.push(
        [{ id: "payout-1" }], // claim 1
        [{ id: "payout-1" }], // paid update 1
        [{ id: "payout-2" }], // claim 2
        [{ id: "payout-2" }], // paid update 2
      );

      mockStripe.transfers.create
        .mockResolvedValueOnce({ id: "tr_1" })
        .mockResolvedValueOnce({ id: "tr_2" });

      const { migratePendingPayoutsToConnect } = await import("@/server/api/lib/payout-calculator");
      const result = await migratePendingPayoutsToConnect("provider-1");

      expect(result).toEqual({ migrated: 2, errors: 0 });
      expect(mockStripe.transfers.create).toHaveBeenCalledTimes(2);
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "payout.auto_migrated" }),
      );
    });

    it("leaves payouts in manual queue when Stripe fails", async () => {
      (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockProvider);
      selectWhereResult = [
        { id: "payout-1", amount: 5000, bookingId: "booking-1", providerId: "provider-1", status: "pending", payoutMethod: "manual_batch" },
      ];

      // Claim succeeds, but Stripe transfer fails
      mockUpdateReturnValues.push([{ id: "payout-1" }]);
      mockStripe.transfers.create.mockRejectedValue(new Error("API error"));

      const { migratePendingPayoutsToConnect } = await import("@/server/api/lib/payout-calculator");
      const result = await migratePendingPayoutsToConnect("provider-1");

      expect(result).toEqual({ migrated: 0, errors: 1 });
      // Should audit the failure (M2 fix)
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "payout.stripe_connect_failed" }),
      );
    });

    it("returns zero when provider has no Connect account", async () => {
      (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockProviderNoConnect);

      const { migratePendingPayoutsToConnect } = await import("@/server/api/lib/payout-calculator");
      const result = await migratePendingPayoutsToConnect("provider-1");

      expect(result).toEqual({ migrated: 0, errors: 0 });
      expect(mockStripe.transfers.create).not.toHaveBeenCalled();
    });
  });
});

describe("Deadline Enforcement Reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateReturnValues = [];
    updateChain = createUpdateChain();
    selectWhereResult = [];
    selectChain = createSelectChain();
    (db.update as ReturnType<typeof vi.fn>).mockImplementation(() => ({ set: updateChain.set }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const where = vi.fn().mockImplementation(() => Promise.resolve(selectWhereResult));
      const fromFn = vi.fn().mockReturnValue({ where });
      return { from: fromFn, where };
    });
  });

  it("suspends non-compliant active providers after grace period", async () => {
    // Reset module registry so doMock takes effect
    vi.resetModules();

    vi.doMock("@/lib/constants", async () => {
      const actual = await vi.importActual("@/lib/constants");
      return {
        ...actual,
        MIGRATION_LAUNCH_DATE: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
        MIGRATION_DEPRECATION_DAYS: 60,
        MIGRATION_GRACE_PERIOD_DAYS: 7,
      };
    });

    selectWhereResult = [
      { id: "provider-1", name: "Test", status: "active", stripeConnectAccountId: null, userId: "user-1" },
    ];
    mockUpdateReturnValues.push([{ id: "provider-1" }]);

    const { enforceStripeConnectDeadline } = await import("@/server/api/lib/reconciliation");
    const result = await enforceStripeConnectDeadline();

    expect(result.checked).toBe(1);
    expect(result.suspended).toBe(1);
  });

  it("does nothing when MIGRATION_LAUNCH_DATE is null", async () => {
    vi.resetModules();

    vi.doMock("@/lib/constants", async () => {
      const actual = await vi.importActual("@/lib/constants");
      return {
        ...actual,
        MIGRATION_LAUNCH_DATE: null,
      };
    });

    const { enforceStripeConnectDeadline } = await import("@/server/api/lib/reconciliation");
    const result = await enforceStripeConnectDeadline();

    expect(result).toEqual({ checked: 0, suspended: 0, errors: 0 });
  });
});

describe("onStripeConnectStepComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateReturnValues = [];
    updateChain = createUpdateChain();
    selectWhereResult = [];
    selectChain = createSelectChain();
    (db.update as ReturnType<typeof vi.fn>).mockImplementation(() => ({ set: updateChain.set }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => selectChain);
  });

  it("reactivates suspended provider when Connect completed", async () => {
    (db.query.providers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "provider-1",
      status: "suspended",
      suspendedReason: "stripe_connect_deadline_expired",
      stripeConnectAccountId: "acct_test",
      userId: "user-1",
    });

    // Mock migratePendingPayoutsToConnect via the import
    selectWhereResult = [];
    mockUpdateReturnValues.push([]); // migration result (empty = no pending)

    const { onStripeConnectStepComplete } = await import("@/server/api/lib/all-steps-complete");

    // Need to wait for the fire-and-forget to settle
    await onStripeConnectStepComplete("provider-1");
    // Allow fire-and-forget to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "provider.reactivated" }),
    );
  });
});

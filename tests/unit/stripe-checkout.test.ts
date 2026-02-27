import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before any import that touches the mocked modules
// ---------------------------------------------------------------------------

const mockCustomersCreate = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      bookings: { findFirst: vi.fn() },
      payments: { findFirst: vi.fn() },
      services: { findFirst: vi.fn() },
    },
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn(),
        retrieve: vi.fn(),
      },
    },
  },
  getStripe: vi.fn(() => ({
    customers: {
      create: mockCustomersCreate,
    },
  })),
}));

// Mock middleware to pass through — they are applied via app.use() so we
// need them to simply call next() without performing auth / rate-limit checks.
vi.mock("@/server/api/middleware/auth", () => ({
  requireAuth: vi.fn(async (c: unknown, next: () => Promise<void>) => {
    // Simulate auth middleware setting the user variable
    (c as { set: (k: string, v: unknown) => void }).set("user", {
      id: "user-1",
      role: "customer",
      name: "Test User",
      email: "test@example.com",
    });
    await next();
  }),
}));

vi.mock("@/server/api/middleware/trust-tier", () => ({
  validatePaymentMethod: vi.fn(
    async (_c: unknown, next: () => Promise<void>) => {
      await next();
    }
  ),
}));

vi.mock("@/server/api/middleware/rate-limit", () => ({
  rateLimitStrict: vi.fn(
    async (_c: unknown, next: () => Promise<void>) => {
      await next();
    }
  ),
}));

// We do NOT mock @/lib/validators — we use the real schemas and the real
// isPaymentMethodAllowedForTier function so we test the actual validation logic.

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { db } from "@/db";
import { stripe } from "@/lib/stripe";
import paymentRoutes from "@/server/api/routes/payments";

// Typed references for convenience
const mockUsersFindFirst = db.query.users.findFirst as ReturnType<typeof vi.fn>;
const mockBookingsFindFirst = db.query.bookings.findFirst as ReturnType<typeof vi.fn>;
const mockPaymentsFindFirst = db.query.payments.findFirst as ReturnType<typeof vi.fn>;
const mockServicesFindFirst = db.query.services.findFirst as ReturnType<typeof vi.fn>;
const mockInsert = db.insert as ReturnType<typeof vi.fn>;
const mockDbUpdate = db.update as ReturnType<typeof vi.fn>;
const mockSessionCreate = stripe.checkout.sessions.create as ReturnType<typeof vi.fn>;
const mockSessionRetrieve = stripe.checkout.sessions.retrieve as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

function setupInsertMock() {
  const values = vi.fn().mockResolvedValue(undefined);
  mockInsert.mockReturnValue({ values });
}

function setupUpdateChain() {
  const whereFn = vi.fn().mockResolvedValue(undefined);
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  mockDbUpdate.mockReturnValue({ set: setFn });
  return { setFn, whereFn };
}

/**
 * Setup standard mocks for a successful checkout flow.
 * The users.findFirst is called twice:
 *   1. Trust tier check (returns { trustTier })
 *   2. getOrCreateStripeCustomer (returns full user with stripeCustomerId)
 */
function setupSuccessfulCheckoutMocks(overrides?: {
  booking?: Record<string, unknown>;
  service?: Record<string, unknown>;
  user?: Record<string, unknown>;
  stripeCustomerId?: string | null;
}) {
  const userForTierCheck = overrides?.user ?? { trustTier: 2 };
  const userForCustomer = {
    id: "user-1",
    stripeCustomerId: overrides?.stripeCustomerId ?? "cus_existing",
    name: "Test User",
    email: "test@example.com",
    phone: null,
  };

  // First call: trust tier check, second call: getOrCreateStripeCustomer
  mockUsersFindFirst
    .mockResolvedValueOnce(userForTierCheck)
    .mockResolvedValueOnce(userForCustomer);

  mockBookingsFindFirst.mockResolvedValue(overrides?.booking ?? defaultBooking);
  mockPaymentsFindFirst.mockResolvedValue(undefined);
  mockServicesFindFirst.mockResolvedValue(overrides?.service ?? defaultService);
  mockSessionCreate.mockResolvedValue(defaultStripeSession);
  setupInsertMock();
}

/**
 * Send a POST /stripe/checkout request to the Hono app under test.
 */
async function postCheckout(body: unknown) {
  const req = new Request("http://localhost/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return paymentRoutes.fetch(req);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const defaultBooking = {
  id: VALID_UUID,
  userId: "user-1",
  serviceId: "svc-1",
  status: "pending",
  estimatedPrice: 5000,
  contactName: "John Doe",
  contactPhone: "4045551234",
};

const defaultService = {
  id: "svc-1",
  name: "Tire Change",
  slug: "tire-change",
  stripeProductId: null, // no linked Stripe Product
};

const defaultStripeSession = {
  id: "cs_test_123",
  url: "https://checkout.stripe.com/pay/cs_test_123",
  status: "open",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /stripe/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore AUTH_URL for the majority of tests
    process.env.AUTH_URL = "https://roadsideatl.com";
  });

  // -----------------------------------------------------------------------
  // 1. Input validation
  // -----------------------------------------------------------------------

  describe("input validation", () => {
    it("returns 400 when bookingId is missing", async () => {
      const res = await postCheckout({});
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Invalid input");
    });

    it("returns 400 when bookingId is not a valid UUID", async () => {
      const res = await postCheckout({ bookingId: "not-a-uuid" });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Invalid input");
    });

    it("returns 400 when bookingId is an empty string", async () => {
      const res = await postCheckout({ bookingId: "" });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Invalid input");
    });
  });

  // -----------------------------------------------------------------------
  // 2. Trust tier defense-in-depth
  // -----------------------------------------------------------------------

  describe("trust tier validation", () => {
    it("returns 400 when user trust tier disallows stripe (tier 1)", async () => {
      mockUsersFindFirst.mockResolvedValue({ trustTier: 1 });

      const res = await postCheckout({ bookingId: VALID_UUID });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Payment method not allowed for your trust tier");
    });

    it("returns 400 when user is not found in the database", async () => {
      mockUsersFindFirst.mockResolvedValue(undefined);

      const res = await postCheckout({ bookingId: VALID_UUID });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Payment method not allowed for your trust tier");
    });
  });

  // -----------------------------------------------------------------------
  // 3. Booking lookup
  // -----------------------------------------------------------------------

  describe("booking lookup", () => {
    it("returns 404 when booking is not found", async () => {
      mockUsersFindFirst.mockResolvedValue({ trustTier: 2 });
      mockBookingsFindFirst.mockResolvedValue(undefined);

      const res = await postCheckout({ bookingId: VALID_UUID });
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBe("Booking not found");
    });
  });

  // -----------------------------------------------------------------------
  // 4. Booking ownership
  // -----------------------------------------------------------------------

  describe("booking ownership", () => {
    it("returns 404 when booking is owned by a different user", async () => {
      mockUsersFindFirst.mockResolvedValue({ trustTier: 2 });
      mockBookingsFindFirst.mockResolvedValue({
        ...defaultBooking,
        userId: "other-user-999",
      });

      const res = await postCheckout({ bookingId: VALID_UUID });
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBe("Booking not found");
    });

    it("allows checkout for guest bookings where userId is null", async () => {
      setupSuccessfulCheckoutMocks({
        booking: { ...defaultBooking, userId: null },
      });

      const res = await postCheckout({ bookingId: VALID_UUID });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.url).toBe(defaultStripeSession.url);
    });
  });

  // -----------------------------------------------------------------------
  // 5. Idempotency — existing pending payment
  // -----------------------------------------------------------------------

  describe("idempotency", () => {
    it("returns existing session URL when pending payment already exists and session is open", async () => {
      mockUsersFindFirst.mockResolvedValue({ trustTier: 2 });
      mockBookingsFindFirst.mockResolvedValue(defaultBooking);
      mockPaymentsFindFirst.mockResolvedValue({
        id: "pay-existing",
        bookingId: VALID_UUID,
        status: "pending",
        stripeSessionId: "cs_existing_456",
      });
      mockSessionRetrieve.mockResolvedValue({
        id: "cs_existing_456",
        status: "open",
        url: "https://checkout.stripe.com/pay/cs_existing_456",
      });

      const res = await postCheckout({ bookingId: VALID_UUID });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.url).toBe("https://checkout.stripe.com/pay/cs_existing_456");

      // Should NOT have created a new session
      expect(mockSessionCreate).not.toHaveBeenCalled();
      // Should NOT have inserted a new payment
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("creates a new session when existing pending payment session is no longer open", async () => {
      // First call: trust tier check
      mockUsersFindFirst
        .mockResolvedValueOnce({ trustTier: 2 })
        // Second call: getOrCreateStripeCustomer
        .mockResolvedValueOnce({
          id: "user-1",
          stripeCustomerId: "cus_existing",
          name: "Test User",
          email: "test@example.com",
          phone: null,
        });
      mockBookingsFindFirst.mockResolvedValue(defaultBooking);
      mockPaymentsFindFirst.mockResolvedValue({
        id: "pay-expired",
        bookingId: VALID_UUID,
        status: "pending",
        stripeSessionId: "cs_expired_789",
      });
      // Session is expired/complete, not open
      mockSessionRetrieve.mockResolvedValue({
        id: "cs_expired_789",
        status: "expired",
        url: null,
      });
      mockServicesFindFirst.mockResolvedValue(defaultService);
      mockSessionCreate.mockResolvedValue(defaultStripeSession);
      setupInsertMock();

      const res = await postCheckout({ bookingId: VALID_UUID });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.url).toBe(defaultStripeSession.url);

      // Should have created a new session since the old one expired
      expect(mockSessionCreate).toHaveBeenCalledOnce();
      expect(mockInsert).toHaveBeenCalledOnce();
    });

    it("creates a new session when no pending payment exists", async () => {
      setupSuccessfulCheckoutMocks();

      const res = await postCheckout({ bookingId: VALID_UUID });
      expect(res.status).toBe(200);

      expect(mockSessionCreate).toHaveBeenCalledOnce();
      expect(mockInsert).toHaveBeenCalledOnce();
    });

    it("creates a new session when pending payment has no stripeSessionId", async () => {
      // First call: trust tier check
      mockUsersFindFirst
        .mockResolvedValueOnce({ trustTier: 2 })
        .mockResolvedValueOnce({
          id: "user-1",
          stripeCustomerId: "cus_existing",
          name: "Test User",
          email: "test@example.com",
          phone: null,
        });
      mockBookingsFindFirst.mockResolvedValue(defaultBooking);
      mockPaymentsFindFirst.mockResolvedValue({
        id: "pay-no-session",
        bookingId: VALID_UUID,
        status: "pending",
        stripeSessionId: null,
      });
      mockServicesFindFirst.mockResolvedValue(defaultService);
      mockSessionCreate.mockResolvedValue(defaultStripeSession);
      setupInsertMock();

      const res = await postCheckout({ bookingId: VALID_UUID });
      expect(res.status).toBe(200);

      // Should fall through the idempotency check and create a new session
      expect(mockSessionCreate).toHaveBeenCalledOnce();
    });
  });

  // -----------------------------------------------------------------------
  // 6. AUTH_URL env var
  // -----------------------------------------------------------------------

  describe("AUTH_URL configuration", () => {
    it("returns 500 when AUTH_URL env var is missing", async () => {
      delete process.env.AUTH_URL;

      mockUsersFindFirst.mockResolvedValue({ trustTier: 2 });
      mockBookingsFindFirst.mockResolvedValue(defaultBooking);
      mockPaymentsFindFirst.mockResolvedValue(undefined);
      mockServicesFindFirst.mockResolvedValue(defaultService);

      const res = await postCheckout({ bookingId: VALID_UUID });
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Server misconfiguration");
    });

    it("returns 500 when AUTH_URL env var is empty string", async () => {
      process.env.AUTH_URL = "";

      mockUsersFindFirst.mockResolvedValue({ trustTier: 2 });
      mockBookingsFindFirst.mockResolvedValue(defaultBooking);
      mockPaymentsFindFirst.mockResolvedValue(undefined);
      mockServicesFindFirst.mockResolvedValue(defaultService);

      const res = await postCheckout({ bookingId: VALID_UUID });
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Server misconfiguration");
    });
  });

  // -----------------------------------------------------------------------
  // 7. Successful checkout session creation
  // -----------------------------------------------------------------------

  describe("successful checkout", () => {
    it("creates a Stripe checkout session and returns the URL", async () => {
      setupSuccessfulCheckoutMocks();

      const res = await postCheckout({ bookingId: VALID_UUID });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.url).toBe(defaultStripeSession.url);
    });

    it("uses estimatedPrice as unit_amount in the Stripe session line items", async () => {
      setupSuccessfulCheckoutMocks({
        booking: { ...defaultBooking, estimatedPrice: 12500 },
      });

      await postCheckout({ bookingId: VALID_UUID });

      expect(mockSessionCreate).toHaveBeenCalledOnce();
      const createArg = mockSessionCreate.mock.calls[0][0];

      expect(createArg.line_items).toHaveLength(1);
      expect(createArg.line_items[0].price_data.unit_amount).toBe(12500);
      expect(createArg.line_items[0].price_data.currency).toBe("usd");
      expect(createArg.line_items[0].quantity).toBe(1);
    });

    it("uses Stripe Product ID when service has stripeProductId", async () => {
      setupSuccessfulCheckoutMocks({
        service: { id: "svc-1", name: "Jump Start", slug: "jump-start", stripeProductId: "prod_abc123" },
      });

      await postCheckout({ bookingId: VALID_UUID });

      const createArg = mockSessionCreate.mock.calls[0][0];
      expect(createArg.line_items[0].price_data.product).toBe("prod_abc123");
      expect(createArg.line_items[0].price_data.product_data).toBeUndefined();
    });

    it("uses inline product_data when service has no stripeProductId", async () => {
      setupSuccessfulCheckoutMocks({
        service: { id: "svc-1", name: "Jump Start", slug: "jump-start", stripeProductId: null },
      });

      await postCheckout({ bookingId: VALID_UUID });

      const createArg = mockSessionCreate.mock.calls[0][0];
      expect(createArg.line_items[0].price_data.product_data.name).toBe("Jump Start");
      expect(createArg.line_items[0].price_data.product).toBeUndefined();
    });

    it("falls back to 'Roadside Service' when service is not found", async () => {
      setupSuccessfulCheckoutMocks({ service: undefined });
      mockServicesFindFirst.mockResolvedValue(undefined);

      await postCheckout({ bookingId: VALID_UUID });

      const createArg = mockSessionCreate.mock.calls[0][0];
      expect(createArg.line_items[0].price_data.product_data.name).toBe("Roadside Service");
    });

    it("includes booking ID in both session and payment_intent_data metadata", async () => {
      setupSuccessfulCheckoutMocks();

      await postCheckout({ bookingId: VALID_UUID });

      const createArg = mockSessionCreate.mock.calls[0][0];
      // Session-level metadata
      expect(createArg.metadata.bookingId).toBe(VALID_UUID);
      expect(createArg.metadata.userId).toBe("user-1");
      // PaymentIntent-level metadata (for webhook cross-referencing)
      expect(createArg.payment_intent_data.metadata.bookingId).toBe(VALID_UUID);
      expect(createArg.payment_intent_data.metadata.userId).toBe("user-1");
    });

    it("sets correct success_url and cancel_url using AUTH_URL", async () => {
      process.env.AUTH_URL = "https://roadsideatl.com";
      setupSuccessfulCheckoutMocks();

      await postCheckout({ bookingId: VALID_UUID });

      const createArg = mockSessionCreate.mock.calls[0][0];
      expect(createArg.success_url).toBe(
        `https://roadsideatl.com/book/confirmation?bookingId=${VALID_UUID}&paid=true`
      );
      expect(createArg.cancel_url).toBe(
        `https://roadsideatl.com/book/confirmation?bookingId=${VALID_UUID}`
      );
    });

    it("sets mode to 'payment' and payment_method_types to ['card']", async () => {
      setupSuccessfulCheckoutMocks();

      await postCheckout({ bookingId: VALID_UUID });

      const createArg = mockSessionCreate.mock.calls[0][0];
      expect(createArg.mode).toBe("payment");
      expect(createArg.payment_method_types).toEqual(["card"]);
    });

    it("passes Stripe customer ID to the checkout session", async () => {
      setupSuccessfulCheckoutMocks({ stripeCustomerId: "cus_abc123" });

      await postCheckout({ bookingId: VALID_UUID });

      const createArg = mockSessionCreate.mock.calls[0][0];
      expect(createArg.customer).toBe("cus_abc123");
    });
  });

  // -----------------------------------------------------------------------
  // 8. Stripe Customer creation
  // -----------------------------------------------------------------------

  describe("Stripe Customer management", () => {
    it("reuses existing stripeCustomerId when available", async () => {
      setupSuccessfulCheckoutMocks({ stripeCustomerId: "cus_existing" });

      await postCheckout({ bookingId: VALID_UUID });

      // Should NOT call customers.create since the user already has a stripeCustomerId
      expect(mockCustomersCreate).not.toHaveBeenCalled();
    });

    it("creates a new Stripe Customer when user has no stripeCustomerId", async () => {
      mockUsersFindFirst
        .mockResolvedValueOnce({ trustTier: 2 })
        .mockResolvedValueOnce({
          id: "user-1",
          stripeCustomerId: null,
          name: "Test User",
          email: "test@example.com",
          phone: "4045551234",
        });
      mockBookingsFindFirst.mockResolvedValue(defaultBooking);
      mockPaymentsFindFirst.mockResolvedValue(undefined);
      mockServicesFindFirst.mockResolvedValue(defaultService);
      mockSessionCreate.mockResolvedValue(defaultStripeSession);
      mockCustomersCreate.mockResolvedValue({ id: "cus_new_123" });
      setupInsertMock();
      setupUpdateChain();

      const res = await postCheckout({ bookingId: VALID_UUID });
      expect(res.status).toBe(200);

      expect(mockCustomersCreate).toHaveBeenCalledOnce();
      expect(mockCustomersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test User",
          email: "test@example.com",
          metadata: { userId: "user-1" },
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // 9. Payment record creation
  // -----------------------------------------------------------------------

  describe("payment record creation", () => {
    it("inserts a pending payment record with correct fields", async () => {
      setupSuccessfulCheckoutMocks();

      const mockValues = vi.fn().mockResolvedValue(undefined);
      mockInsert.mockReturnValue({ values: mockValues });

      await postCheckout({ bookingId: VALID_UUID });

      // Verify db.insert was called (with the payments table reference)
      expect(mockInsert).toHaveBeenCalledOnce();

      // Verify the values passed to .values()
      expect(mockValues).toHaveBeenCalledOnce();
      const insertedValues = mockValues.mock.calls[0][0];
      expect(insertedValues).toEqual({
        bookingId: VALID_UUID,
        amount: 5000,
        method: "stripe",
        status: "pending",
        stripeSessionId: "cs_test_123",
      });
    });

    it("uses the booking estimatedPrice as the payment amount", async () => {
      setupSuccessfulCheckoutMocks({
        booking: { ...defaultBooking, estimatedPrice: 25000 },
      });

      const mockValues = vi.fn().mockResolvedValue(undefined);
      mockInsert.mockReturnValue({ values: mockValues });

      await postCheckout({ bookingId: VALID_UUID });

      const insertedValues = mockValues.mock.calls[0][0];
      expect(insertedValues.amount).toBe(25000);
    });
  });

  // -----------------------------------------------------------------------
  // 10. Edge cases and boundary conditions
  // -----------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles booking with estimatedPrice of 0", async () => {
      setupSuccessfulCheckoutMocks({
        booking: { ...defaultBooking, estimatedPrice: 0 },
      });

      const res = await postCheckout({ bookingId: VALID_UUID });
      // Should still proceed to create a session (Stripe validates amount)
      expect(res.status).toBe(200);

      const createArg = mockSessionCreate.mock.calls[0][0];
      expect(createArg.line_items[0].price_data.unit_amount).toBe(0);
    });

    it("includes truncated booking ID in product description when no stripeProductId", async () => {
      setupSuccessfulCheckoutMocks({
        service: { id: "svc-1", name: "Test", slug: "test", stripeProductId: null },
      });

      await postCheckout({ bookingId: VALID_UUID });

      const createArg = mockSessionCreate.mock.calls[0][0];
      const description = createArg.line_items[0].price_data.product_data.description;
      // Should contain first 8 chars of the booking ID
      expect(description).toBe(`Booking #${VALID_UUID.slice(0, 8)}`);
    });

    it("allows checkout when booking userId matches authenticated user", async () => {
      setupSuccessfulCheckoutMocks({
        booking: { ...defaultBooking, userId: "user-1" },
      });

      const res = await postCheckout({ bookingId: VALID_UUID });
      expect(res.status).toBe(200);
    });

    it("allows checkout for tier 2 users", async () => {
      setupSuccessfulCheckoutMocks();

      const res = await postCheckout({ bookingId: VALID_UUID });
      expect(res.status).toBe(200);
    });

    it("allows checkout for tier 3+ users (higher trust)", async () => {
      setupSuccessfulCheckoutMocks({ user: { trustTier: 3 } });

      const res = await postCheckout({ bookingId: VALID_UUID });
      expect(res.status).toBe(200);
    });
  });
});

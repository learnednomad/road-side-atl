import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module and invoice generator
vi.mock("@/db", () => ({
  db: {
    query: {
      bookings: { findFirst: vi.fn() },
      payments: { findFirst: vi.fn() },
      providers: { findFirst: vi.fn() },
      providerPayouts: { findFirst: vi.fn() },
      services: { findFirst: vi.fn() },
    },
    insert: vi.fn(),
  },
}));

vi.mock("@/server/api/lib/invoice-generator", () => ({
  createInvoiceForBooking: vi.fn().mockResolvedValue(null),
}));

import { db } from "@/db";
import { createPayoutIfEligible } from "@/server/api/lib/payout-calculator";

const mockBookings = db.query.bookings.findFirst as ReturnType<typeof vi.fn>;
const mockPayments = db.query.payments.findFirst as ReturnType<typeof vi.fn>;
const mockProviders = db.query.providers.findFirst as ReturnType<typeof vi.fn>;
const mockPayouts = db.query.providerPayouts.findFirst as ReturnType<typeof vi.fn>;
const mockServices = db.query.services.findFirst as ReturnType<typeof vi.fn>;
const mockInsert = db.insert as ReturnType<typeof vi.fn>;

function setupInsertMock(returnValue: Record<string, unknown>) {
  const returning = vi.fn().mockResolvedValue([returnValue]);
  const values = vi.fn().mockReturnValue({ returning });
  mockInsert.mockReturnValue({ values });
}

describe("createPayoutIfEligible", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when booking not found", async () => {
    mockBookings.mockResolvedValue(undefined);
    expect(await createPayoutIfEligible("b-1")).toBeNull();
  });

  it("returns null when booking is not completed", async () => {
    mockBookings.mockResolvedValue({ id: "b-1", status: "pending", providerId: "p-1" });
    expect(await createPayoutIfEligible("b-1")).toBeNull();
  });

  it("returns null when booking has no provider", async () => {
    mockBookings.mockResolvedValue({ id: "b-1", status: "completed", providerId: null });
    expect(await createPayoutIfEligible("b-1")).toBeNull();
  });

  it("returns null when no confirmed payment exists", async () => {
    mockBookings.mockResolvedValue({ id: "b-1", status: "completed", providerId: "p-1" });
    mockPayments.mockResolvedValue(undefined);
    expect(await createPayoutIfEligible("b-1")).toBeNull();
  });

  it("returns existing payout if already created", async () => {
    const existingPayout = { id: "po-1", bookingId: "b-1", amount: 3000 };
    mockBookings.mockResolvedValue({ id: "b-1", status: "completed", providerId: "p-1" });
    mockPayments.mockResolvedValue({ bookingId: "b-1", status: "confirmed", amount: 5000 });
    mockPayouts.mockResolvedValue(existingPayout);

    expect(await createPayoutIfEligible("b-1")).toEqual(existingPayout);
  });

  it("calculates payout using service commission rate (standard path)", async () => {
    mockBookings.mockResolvedValue({
      id: "b-1", status: "completed", providerId: "p-1",
      serviceId: "svc-1", priceOverrideCents: null,
    });
    mockPayments.mockResolvedValue({ bookingId: "b-1", status: "confirmed", amount: 10000 });
    mockPayouts.mockResolvedValue(undefined);
    mockProviders.mockResolvedValue({
      id: "p-1", commissionType: "percentage", commissionRate: 7500, flatFeeAmount: null,
    });
    mockServices.mockResolvedValue({ id: "svc-1", commissionRate: 2500 }); // 25% platform cut

    const expectedPayout = {
      id: "po-new", providerId: "p-1", bookingId: "b-1",
      amount: 7500, // 10000 - (10000 * 2500 / 10000) = 7500
      status: "pending",
    };
    setupInsertMock(expectedPayout);

    const result = await createPayoutIfEligible("b-1");
    expect(result).toEqual(expectedPayout);
  });

  it("uses flat_per_job when provider has flat arrangement", async () => {
    mockBookings.mockResolvedValue({
      id: "b-1", status: "completed", providerId: "p-1",
      serviceId: "svc-1", priceOverrideCents: null,
    });
    mockPayments.mockResolvedValue({ bookingId: "b-1", status: "confirmed", amount: 10000 });
    mockPayouts.mockResolvedValue(undefined);
    mockProviders.mockResolvedValue({
      id: "p-1", commissionType: "flat_per_job", commissionRate: 0, flatFeeAmount: 4000,
    });
    mockServices.mockResolvedValue({ id: "svc-1", commissionRate: 2500 });

    const expectedPayout = { id: "po-flat", amount: 4000, status: "pending" };
    setupInsertMock(expectedPayout);

    const result = await createPayoutIfEligible("b-1");
    expect(result!.amount).toBe(4000);
  });

  it("falls back to provider commission rate when service rate is 0", async () => {
    mockBookings.mockResolvedValue({
      id: "b-1", status: "completed", providerId: "p-1",
      serviceId: "svc-1", priceOverrideCents: null,
    });
    mockPayments.mockResolvedValue({ bookingId: "b-1", status: "confirmed", amount: 10000 });
    mockPayouts.mockResolvedValue(undefined);
    mockProviders.mockResolvedValue({
      id: "p-1", commissionType: "percentage", commissionRate: 7500, flatFeeAmount: null,
    });
    mockServices.mockResolvedValue({ id: "svc-1", commissionRate: 0 }); // No service-level rate

    const expectedPayout = {
      id: "po-fallback", amount: 7500, // 10000 * 7500 / 10000
      status: "pending",
    };
    setupInsertMock(expectedPayout);

    const result = await createPayoutIfEligible("b-1");
    expect(result!.amount).toBe(7500);
  });

  it("uses priceOverrideCents when present", async () => {
    mockBookings.mockResolvedValue({
      id: "b-1", status: "completed", providerId: "p-1",
      serviceId: "svc-1", priceOverrideCents: 8000, // Override price
    });
    mockPayments.mockResolvedValue({ bookingId: "b-1", status: "confirmed", amount: 10000 });
    mockPayouts.mockResolvedValue(undefined);
    mockProviders.mockResolvedValue({
      id: "p-1", commissionType: "percentage", commissionRate: 7500, flatFeeAmount: null,
    });
    mockServices.mockResolvedValue({ id: "svc-1", commissionRate: 2500 }); // 25% platform cut

    const expectedPayout = {
      id: "po-override", amount: 6000, // 8000 - (8000 * 2500 / 10000) = 6000
      status: "pending",
    };
    setupInsertMock(expectedPayout);

    const result = await createPayoutIfEligible("b-1");
    expect(result!.amount).toBe(6000);
  });

  it("returns null when provider not found", async () => {
    mockBookings.mockResolvedValue({
      id: "b-1", status: "completed", providerId: "p-1", serviceId: "svc-1",
    });
    mockPayments.mockResolvedValue({ bookingId: "b-1", status: "confirmed", amount: 10000 });
    mockPayouts.mockResolvedValue(undefined);
    mockProviders.mockResolvedValue(undefined);

    expect(await createPayoutIfEligible("b-1")).toBeNull();
  });
});

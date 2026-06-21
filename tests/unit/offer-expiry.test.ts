import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — DB is the sole controllable source; everything else is a no-op spy.
// ---------------------------------------------------------------------------
const {
  mockSelectWhere, // returns the "expired offers" array
  mockUpdateReturning, // returns the rows the guarded revert UPDATE matched
  mockInsertValues,
  mockDispatchLogsFindMany,
  mockProvidersFindFirst,
  mockAutoDispatchV2,
} = vi.hoisted(() => ({
  mockSelectWhere: vi.fn(),
  mockUpdateReturning: vi.fn(),
  mockInsertValues: vi.fn(() => Promise.resolve()),
  mockDispatchLogsFindMany: vi.fn(() => Promise.resolve([])),
  mockProvidersFindFirst: vi.fn(() => Promise.resolve(undefined)),
  mockAutoDispatchV2: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: mockSelectWhere })) })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockUpdateReturning })) })),
    })),
    insert: vi.fn(() => ({ values: mockInsertValues })),
    query: {
      providers: { findFirst: mockProvidersFindFirst },
      dispatchLogs: { findMany: mockDispatchLogsFindMany },
    },
  },
}));

vi.mock("@/db/schema", () => ({
  bookings: { id: "id", status: "status", offerExpiresAt: "offerExpiresAt", providerId: "providerId" },
  dispatchLogs: { bookingId: "bookingId" },
  providers: { id: "id", userId: "userId" },
}));

vi.mock("@/server/websocket/broadcast", () => ({
  broadcastToProvider: vi.fn(),
  broadcastToAdmins: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

vi.mock("@/server/api/lib/auto-dispatch-v2", () => ({
  autoDispatchBookingV2: mockAutoDispatchV2,
}));

import { processExpiredOffers } from "@/server/api/lib/offer-expiry";

const mkBooking = (over: Record<string, unknown> = {}) => ({
  id: "b1",
  status: "dispatched",
  providerId: "prov1",
  offerExpiresAt: new Date(Date.now() - 1000),
  dispatchAttempt: 1,
  userId: "u1",
  ...over,
});

describe("processExpiredOffers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue(undefined);
    mockDispatchLogsFindMany.mockResolvedValue([]);
    mockProvidersFindFirst.mockResolvedValue(undefined);
  });

  it("reverts an expired offer (guarded UPDATE matches) and cascades to the next provider", async () => {
    mockSelectWhere.mockResolvedValue([mkBooking({ dispatchAttempt: 1 })]);
    mockUpdateReturning.mockResolvedValue([{ id: "b1" }]); // revert won the race
    mockAutoDispatchV2.mockResolvedValue({ success: true });

    const res = await processExpiredOffers();

    expect(res.expired).toBe(1);
    expect(res.redispatched).toBe(1);
    expect(res.manualNeeded).toBe(0);
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ outcome: "expired" }));
    expect(mockAutoDispatchV2).toHaveBeenCalledWith("b1", expect.objectContaining({ attempt: 2 }));
  });

  it("does NOT revert, log, or cascade when the provider accepted in the race window", async () => {
    // The guarded revert UPDATE (status='dispatched' AND offerExpiresAt=observed)
    // matches no row because the booking was accepted concurrently.
    mockSelectWhere.mockResolvedValue([mkBooking()]);
    mockUpdateReturning.mockResolvedValue([]); // lost the race

    const res = await processExpiredOffers();

    expect(res.expired).toBe(0);
    expect(res.redispatched).toBe(0);
    expect(res.manualNeeded).toBe(0);
    expect(mockInsertValues).not.toHaveBeenCalled();
    expect(mockAutoDispatchV2).not.toHaveBeenCalled();
  });

  it("escalates to manual after the max cascade attempts and does not cascade further", async () => {
    mockSelectWhere.mockResolvedValue([mkBooking({ dispatchAttempt: 3 })]); // == MAX_DISPATCH_CASCADE_ATTEMPTS
    mockUpdateReturning.mockResolvedValue([{ id: "b1" }]);

    const res = await processExpiredOffers();

    expect(res.expired).toBe(1);
    expect(res.manualNeeded).toBe(1);
    expect(res.redispatched).toBe(0);
    expect(mockAutoDispatchV2).not.toHaveBeenCalled();
  });

  it("returns zero counts when there are no expired offers", async () => {
    mockSelectWhere.mockResolvedValue([]);
    const res = await processExpiredOffers();
    expect(res).toEqual({ expired: 0, redispatched: 0, manualNeeded: 0 });
  });
});

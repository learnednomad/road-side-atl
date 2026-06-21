import { describe, it, expect, vi, beforeEach } from "vitest";

// #150 — lock the NET credit-limit deduction in createB2bBooking: the locked
// balance read + limit guard + charge ledger row + balance bump.
const h = vi.hoisted(() => ({
  acctRow: vi.fn(() => [{ balance: 0, limit: 0 }] as Array<{ balance: number; limit: number }>),
  inserts: [] as Array<{ table: string; vals: Record<string, unknown> }>,
  balanceUpdate: vi.fn(() => Promise.resolve()),
  finalPrice: vi.fn(() => 5000),
}));

vi.mock("@/db/schema", () => ({
  bookings: { __t: "bookings", id: "id" },
  b2bAccounts: { __t: "b2bAccounts", id: "id", currentBalanceCents: "currentBalanceCents", creditLimitCents: "creditLimitCents" },
  b2bCreditTransactions: { __t: "b2bCreditTransactions" },
  b2bPriceList: { __t: "b2bPriceList", accountId: "accountId", serviceId: "serviceId" },
  fleetVehicles: { __t: "fleetVehicles", id: "id", accountId: "accountId" },
}));

vi.mock("@/db", () => {
  const tx = {
    select: () => ({ from: () => ({ where: () => { const p: Promise<unknown> & { for?: () => Promise<unknown> } = Promise.resolve(h.acctRow()); p.for = () => Promise.resolve(h.acctRow()); return p; } }) }),
    insert: (table: { __t: string }) => ({
      values: (vals: Record<string, unknown>) => {
        h.inserts.push({ table: table.__t, vals });
        if (table.__t === "bookings") return { returning: () => Promise.resolve([{ id: "b-1", ...vals }]) };
        return Promise.resolve();
      },
    }),
    update: () => ({ set: () => ({ where: h.balanceUpdate }) }),
  };
  return {
    db: {
      query: {
        b2bPriceList: { findFirst: vi.fn(() => Promise.resolve(null)) },
        fleetVehicles: { findFirst: vi.fn(() => Promise.resolve(null)) },
      },
      transaction: (cb: (t: typeof tx) => unknown) => cb(tx),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([{ id: "b-1" }]) }) }),
    },
  };
});

vi.mock("@/server/api/lib/pricing-engine", () => ({
  calculateBookingPrice: () => Promise.resolve({ finalPrice: h.finalPrice(), basePrice: h.finalPrice(), multiplier: 1, blockName: null }),
}));
vi.mock("@/lib/geocoding", () => ({ geocodeAddress: () => Promise.resolve({ latitude: 33.7, longitude: -84.4, placeId: "p" }) }));
vi.mock("@/lib/notifications", () => ({ notifyB2bServiceDispatched: vi.fn(() => Promise.resolve()) }));
vi.mock("./auto-dispatch", () => ({ autoDispatchBooking: vi.fn(() => Promise.resolve(null)) }));
vi.mock("@/server/api/lib/auto-dispatch", () => ({ autoDispatchBooking: vi.fn(() => Promise.resolve(null)) }));
vi.mock("./outbound-webhooks", () => ({ emitPartnerEvent: vi.fn() }));

import { createB2bBooking, CreditLimitError } from "@/server/api/lib/b2b-booking";

const account = (over: Record<string, unknown> = {}) => ({
  id: "acct-1", companyName: "Acme", paymentTerms: "net_30", creditLimitCents: 0, ...over,
});
const service = { id: "svc-1", name: "Jump Start", slug: "jump-start" };
const data = {
  serviceId: "svc-1",
  vehicleInfo: { year: "2020", make: "Honda", model: "Civic", color: "Blue" },
  location: { address: "1 Main St", latitude: 33.7, longitude: -84.4 },
  contactName: "Pat", contactPhone: "404-555-0100", contactEmail: "pat@acme.com",
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  h.inserts.length = 0;
  h.acctRow.mockReturnValue([{ balance: 0, limit: 0 }]);
  h.finalPrice.mockReturnValue(5000);
  h.balanceUpdate.mockResolvedValue(undefined);
  process.env.AUTO_DISPATCH_ENABLED = "false";
});

describe("createB2bBooking NET credit deduction (#150)", () => {
  it("charges the ledger by estimatedPrice and bumps the balance", async () => {
    h.acctRow.mockReturnValue([{ balance: 2000, limit: 0 }]); // limit 0 = track, don't cap

    const { booking } = await createB2bBooking(account(), service, data);

    expect(booking.id).toBe("b-1");
    const charge = h.inserts.find((i) => i.table === "b2bCreditTransactions");
    expect(charge?.vals).toMatchObject({ type: "charge", amountCents: 5000, accountId: "acct-1" });
    expect(h.balanceUpdate).toHaveBeenCalledTimes(1); // 2000 + 5000
  });

  it("throws CreditLimitError and writes NOTHING when the charge would exceed a positive limit", async () => {
    h.acctRow.mockReturnValue([{ balance: 9000, limit: 10000 }]); // 9000 + 5000 > 10000

    await expect(createB2bBooking(account({ creditLimitCents: 10000 }), service, data)).rejects.toBeInstanceOf(CreditLimitError);

    expect(h.inserts.find((i) => i.table === "bookings")).toBeUndefined();
    expect(h.inserts.find((i) => i.table === "b2bCreditTransactions")).toBeUndefined();
    expect(h.balanceUpdate).not.toHaveBeenCalled();
  });

  it("allows the booking when under a positive limit", async () => {
    h.acctRow.mockReturnValue([{ balance: 1000, limit: 10000 }]); // 1000 + 5000 <= 10000
    const { booking } = await createB2bBooking(account({ creditLimitCents: 10000 }), service, data);
    expect(booking.id).toBe("b-1");
    expect(h.inserts.find((i) => i.table === "b2bCreditTransactions")?.vals).toMatchObject({ amountCents: 5000 });
  });
});

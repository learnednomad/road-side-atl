import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks: db.transaction drives a tx whose select() yields a queued ledger array
// (awaited) and an account row (via .for("update")). insert/update are spies.
// ---------------------------------------------------------------------------
const { mockLedgerRows, mockAccountRow, mockInsertValues, mockUpdateWhere } = vi.hoisted(() => ({
  mockLedgerRows: vi.fn(() => [] as Array<{ amountCents: number; type: string; accountId: string }>),
  mockAccountRow: vi.fn(() => [{ balance: 0 }] as Array<{ balance: number }>),
  mockInsertValues: vi.fn(() => Promise.resolve()),
  mockUpdateWhere: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/db", () => {
  const txWhere = () => {
    const p: Promise<unknown> & { for?: () => Promise<unknown> } = Promise.resolve(mockLedgerRows());
    p.for = () => Promise.resolve(mockAccountRow());
    return p;
  };
  const tx = {
    select: () => ({ from: () => ({ where: txWhere }) }),
    insert: () => ({ values: mockInsertValues }),
    update: () => ({ set: () => ({ where: mockUpdateWhere }) }),
  };
  return { db: { transaction: (cb: (t: typeof tx) => unknown) => cb(tx) } };
});

vi.mock("@/db/schema", () => ({
  b2bAccounts: { id: "id", currentBalanceCents: "currentBalanceCents" },
  b2bCreditTransactions: { bookingId: "bookingId", amountCents: "amountCents", type: "type", accountId: "accountId" },
}));

import { reverseB2bCreditForBooking, adjustB2bCreditToFinalPrice } from "@/server/api/lib/b2b-credit";

const charge = (amountCents: number) => ({ amountCents, type: "charge", accountId: "acct-1" });
const adjustment = (amountCents: number) => ({ amountCents, type: "adjustment", accountId: "acct-1" });

beforeEach(() => {
  vi.clearAllMocks();
  mockInsertValues.mockResolvedValue(undefined);
  mockUpdateWhere.mockResolvedValue(undefined);
});

describe("reverseB2bCreditForBooking (#138)", () => {
  it("posts a reversing adjustment for the full net and is a no-op afterward", async () => {
    mockLedgerRows.mockReturnValue([charge(10000)]);
    mockAccountRow.mockReturnValue([{ balance: 10000 }]);

    await reverseB2bCreditForBooking("b-1");

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ type: "adjustment", amountCents: -10000, bookingId: "b-1" }),
    );
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1); // balance decremented
  });

  it("reverses the full net including prior adjustments", async () => {
    mockLedgerRows.mockReturnValue([charge(10000), adjustment(2000)]); // net 12000
    mockAccountRow.mockReturnValue([{ balance: 12000 }]);

    await reverseB2bCreditForBooking("b-1");

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ type: "adjustment", amountCents: -12000 }),
    );
  });

  it("is a no-op for a non-B2B booking (no charge row)", async () => {
    mockLedgerRows.mockReturnValue([]);
    await reverseB2bCreditForBooking("b-1");
    expect(mockInsertValues).not.toHaveBeenCalled();
    expect(mockUpdateWhere).not.toHaveBeenCalled();
  });

  it("is idempotent — no-op when already net-zero (reversed)", async () => {
    mockLedgerRows.mockReturnValue([charge(10000), adjustment(-10000)]);
    await reverseB2bCreditForBooking("b-1");
    expect(mockInsertValues).not.toHaveBeenCalled();
  });
});

describe("adjustB2bCreditToFinalPrice (#140)", () => {
  it("posts the delta when finalPrice exceeds the charged estimate", async () => {
    mockLedgerRows.mockReturnValue([charge(10000)]); // net 10000
    mockAccountRow.mockReturnValue([{ balance: 10000 }]);

    await adjustB2bCreditToFinalPrice("b-1", 12000);

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ type: "adjustment", amountCents: 2000, bookingId: "b-1" }),
    );
  });

  it("posts a negative delta when finalPrice is below the estimate", async () => {
    mockLedgerRows.mockReturnValue([charge(10000)]);
    mockAccountRow.mockReturnValue([{ balance: 10000 }]);

    await adjustB2bCreditToFinalPrice("b-1", 8000);

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: -2000 }),
    );
  });

  it("is a no-op when already at the final price (idempotent)", async () => {
    mockLedgerRows.mockReturnValue([charge(10000)]);
    await adjustB2bCreditToFinalPrice("b-1", 10000);
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("is a no-op for a non-B2B booking (no charge row)", async () => {
    mockLedgerRows.mockReturnValue([]);
    await adjustB2bCreditToFinalPrice("b-1", 12000);
    expect(mockInsertValues).not.toHaveBeenCalled();
  });
});

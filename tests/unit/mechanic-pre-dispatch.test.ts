import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ----

const mockFrom = vi.fn();
const mockInnerJoin = vi.fn();
const mockWhere = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: mockFrom,
    })),
  },
}));

mockFrom.mockReturnValue({ innerJoin: mockInnerJoin });
mockInnerJoin.mockReturnValue({ where: mockWhere });
mockWhere.mockResolvedValue([]);

vi.mock("@/db/schema", () => ({
  bookings: {
    id: "id",
    status: "status",
    providerId: "providerId",
    serviceId: "serviceId",
    scheduledAt: "scheduledAt",
    contactName: "contactName",
  },
  services: {
    id: "id",
    category: "category",
    name: "name",
  },
}));

const mockAutoDispatch = vi.fn();
vi.mock("@/server/api/lib/auto-dispatch", () => ({
  autoDispatchBooking: (...args: unknown[]) => mockAutoDispatch(...args),
}));

const mockBroadcastToAdmins = vi.fn();
vi.mock("@/server/websocket/broadcast", () => ({
  broadcastToAdmins: (...args: unknown[]) => mockBroadcastToAdmins(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import { findAndDispatchMechanicBookings } from "@/server/api/lib/mechanic-pre-dispatch";

describe("mechanic-pre-dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWhere.mockResolvedValue([]);
  });

  describe("findAndDispatchMechanicBookings", () => {
    it("returns zeroes when no eligible bookings exist", async () => {
      mockWhere.mockResolvedValue([]);

      const result = await findAndDispatchMechanicBookings();

      expect(result).toEqual({
        scanned: 0,
        mechanicEligible: 0,
        dispatched: 0,
        failed: 0,
      });
    });

    it("filters out non-mechanics bookings", async () => {
      // Return a roadside booking - should be excluded
      mockWhere.mockResolvedValue([
        {
          booking: {
            id: "b1",
            status: "confirmed",
            providerId: null,
            scheduledAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
          },
          service: {
            id: "s1",
            category: "roadside",
            name: "Towing",
          },
        },
      ]);

      const result = await findAndDispatchMechanicBookings();

      expect(result.scanned).toBe(1);
      expect(result.mechanicEligible).toBe(0);
      expect(result.dispatched).toBe(0);
      expect(mockAutoDispatch).not.toHaveBeenCalled();
    });

    it("dispatches mechanics bookings within the 2-hour window", async () => {
      mockWhere.mockResolvedValue([
        {
          booking: {
            id: "b1",
            status: "confirmed",
            providerId: null,
            scheduledAt: new Date(Date.now() + 90 * 60 * 1000), // 1.5 hours from now
          },
          service: {
            id: "s1",
            category: "mechanics",
            name: "Oil Change",
          },
        },
      ]);

      mockAutoDispatch.mockResolvedValue({ success: true, providerId: "p1" });

      const result = await findAndDispatchMechanicBookings();

      expect(result.mechanicEligible).toBe(1);
      expect(result.dispatched).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockAutoDispatch).toHaveBeenCalledWith("b1");
    });

    it("handles dispatch failure and broadcasts to admins", async () => {
      mockWhere.mockResolvedValue([
        {
          booking: {
            id: "b2",
            status: "confirmed",
            providerId: null,
            scheduledAt: new Date(Date.now() + 30 * 60 * 1000),
          },
          service: {
            id: "s2",
            category: "mechanics",
            name: "Brake Inspection",
          },
        },
      ]);

      mockAutoDispatch.mockResolvedValue({
        success: false,
        reason: "No providers within range",
      });

      const result = await findAndDispatchMechanicBookings();

      expect(result.dispatched).toBe(0);
      expect(result.failed).toBe(1);
      expect(mockBroadcastToAdmins).toHaveBeenCalledWith({
        type: "booking:dispatch_failed",
        data: {
          bookingId: "b2",
          reason: "No providers within range",
        },
      });
    });

    it("handles autoDispatch throwing an error without stopping the loop", async () => {
      mockWhere.mockResolvedValue([
        {
          booking: {
            id: "b3",
            status: "confirmed",
            providerId: null,
            scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
          },
          service: {
            id: "s3",
            category: "mechanics",
            name: "Battery Check",
          },
        },
        {
          booking: {
            id: "b4",
            status: "confirmed",
            providerId: null,
            scheduledAt: new Date(Date.now() + 45 * 60 * 1000),
          },
          service: {
            id: "s4",
            category: "mechanics",
            name: "Engine Diagnostic",
          },
        },
      ]);

      mockAutoDispatch
        .mockRejectedValueOnce(new Error("Network failure"))
        .mockResolvedValueOnce({ success: true, providerId: "p2" });

      const result = await findAndDispatchMechanicBookings();

      expect(result.mechanicEligible).toBe(2);
      expect(result.dispatched).toBe(1);
      expect(result.failed).toBe(1);
      // Both bookings should have been attempted
      expect(mockAutoDispatch).toHaveBeenCalledTimes(2);
    });

    it("processes multiple mechanic bookings independently", async () => {
      mockWhere.mockResolvedValue([
        {
          booking: {
            id: "b5",
            status: "confirmed",
            providerId: null,
            scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
          },
          service: { id: "s5", category: "mechanics", name: "Tire Rotation" },
        },
        {
          booking: {
            id: "b6",
            status: "confirmed",
            providerId: null,
            scheduledAt: new Date(Date.now() + 90 * 60 * 1000),
          },
          service: { id: "s6", category: "mechanics", name: "AC Repair" },
        },
      ]);

      mockAutoDispatch
        .mockResolvedValueOnce({ success: true, providerId: "p1" })
        .mockResolvedValueOnce({ success: true, providerId: "p2" });

      const result = await findAndDispatchMechanicBookings();

      expect(result.mechanicEligible).toBe(2);
      expect(result.dispatched).toBe(2);
      expect(result.failed).toBe(0);
    });

    it("handles mixed mechanics and non-mechanics bookings correctly", async () => {
      mockWhere.mockResolvedValue([
        {
          booking: {
            id: "b7",
            status: "confirmed",
            providerId: null,
            scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
          },
          service: { id: "s7", category: "mechanics", name: "Oil Change" },
        },
        {
          booking: {
            id: "b8",
            status: "confirmed",
            providerId: null,
            scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
          },
          service: { id: "s8", category: "diagnostics", name: "Pre-Purchase Inspection" },
        },
        {
          booking: {
            id: "b9",
            status: "confirmed",
            providerId: null,
            scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
          },
          service: { id: "s9", category: "roadside", name: "Jump Start" },
        },
      ]);

      mockAutoDispatch.mockResolvedValue({ success: true, providerId: "p1" });

      const result = await findAndDispatchMechanicBookings();

      expect(result.scanned).toBe(3);
      expect(result.mechanicEligible).toBe(1);
      expect(result.dispatched).toBe(1);
      expect(mockAutoDispatch).toHaveBeenCalledTimes(1);
      expect(mockAutoDispatch).toHaveBeenCalledWith("b7");
    });
  });
});

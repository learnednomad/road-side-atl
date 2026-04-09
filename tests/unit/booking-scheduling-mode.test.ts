import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies before imports
vi.mock("@/db", () => ({
  db: {
    query: {
      services: { findFirst: vi.fn() },
      bookings: { findFirst: vi.fn() },
      platformSettings: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{
          id: "booking-1",
          userId: null,
          serviceId: "svc-1",
          status: "pending",
          contactName: "Test User",
          scheduledAt: null,
        }])),
        onConflictDoNothing: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/server/api/lib/pricing-engine", () => ({
  calculateBookingPrice: vi.fn(() =>
    Promise.resolve({ basePrice: 5000, multiplier: 10000, blockName: "Standard", finalPrice: 5000 })
  ),
}));

vi.mock("@/lib/geocoding", () => ({
  geocodeAddress: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/lib/notifications", () => ({
  notifyBookingCreated: vi.fn(() => Promise.resolve()),
  notifyStatusChange: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/server/websocket/broadcast", () => ({
  broadcastToAdmins: vi.fn(),
  broadcastToUser: vi.fn(),
}));

vi.mock("@/server/api/lib/auto-dispatch", () => ({
  autoDispatchBooking: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/server/api/middleware/rate-limit", () => ({
  rateLimitStrict: vi.fn((_c: unknown, next: () => Promise<void>) => next()),
}));

vi.mock("@/server/api/lib/audit-logger", () => ({
  logAudit: vi.fn(),
  getRequestInfo: vi.fn(() => ({ ipAddress: "127.0.0.1", userAgent: "test" })),
}));

vi.mock("@/server/api/middleware/auth", () => ({
  requireAuth: vi.fn((_c: unknown, next: () => Promise<void>) => next()),
}));

vi.mock("@/server/api/lib/beta", () => ({
  isBetaActive: vi.fn(() => Promise.resolve(false)),
}));

import { db } from "@/db";
import app from "@/server/api/routes/bookings";

const mockServiceFindFirst = db.query.services.findFirst as ReturnType<typeof vi.fn>;

const TEST_SERVICE_ID = crypto.randomUUID();

function makeBookingBody(overrides: Record<string, unknown> = {}) {
  return {
    serviceId: TEST_SERVICE_ID,
    vehicleInfo: { year: "2020", make: "Honda", model: "Civic", color: "Blue" },
    location: { address: "123 Main St, Atlanta, GA 30301" },
    contactName: "Test User",
    contactPhone: "4045551234",
    contactEmail: "test@example.com",
    ...overrides,
  };
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Booking schedulingMode validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects scheduled-only service when scheduledAt is missing", async () => {
    mockServiceFindFirst.mockResolvedValue({
      id: TEST_SERVICE_ID,
      name: "Oil Change",
      slug: "oil-change",
      schedulingMode: "scheduled",
      basePrice: 5000,
    });

    const req = makeRequest(makeBookingBody());
    const res = await app.request(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Mechanic services require a scheduled date");
  });

  it("rejects scheduled-only service when scheduledAt is in the past (via Zod refinement)", async () => {
    // scheduledAt only 30 minutes from now (must be 2h+ ahead)
    const pastDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const req = makeRequest(makeBookingBody({ scheduledAt: pastDate }));
    const res = await app.request(req);

    // Zod refinement catches this before handler logic
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid input");
    const scheduledAtIssue = json.details.find(
      (d: { path: string[] }) => d.path.includes("scheduledAt")
    );
    expect(scheduledAtIssue.message).toBe("Scheduled time must be at least 2 hours from now");
  });

  it("accepts scheduled-only service with valid future scheduledAt", async () => {
    const futureDate = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    mockServiceFindFirst.mockResolvedValue({
      id: TEST_SERVICE_ID,
      name: "Oil Change",
      slug: "oil-change",
      schedulingMode: "scheduled",
      basePrice: 5000,
    });

    const req = makeRequest(makeBookingBody({ scheduledAt: futureDate }));
    const res = await app.request(req);

    expect(res.status).toBe(201);
  });

  it("allows 'both' mode service without scheduledAt (immediate booking)", async () => {
    mockServiceFindFirst.mockResolvedValue({
      id: TEST_SERVICE_ID,
      name: "Towing",
      slug: "towing",
      schedulingMode: "both",
      basePrice: 5000,
    });

    const req = makeRequest(makeBookingBody());
    const res = await app.request(req);

    expect(res.status).toBe(201);
  });

  it("allows 'immediate' mode service without scheduledAt", async () => {
    mockServiceFindFirst.mockResolvedValue({
      id: TEST_SERVICE_ID,
      name: "Jumpstart",
      slug: "jumpstart",
      schedulingMode: "immediate",
      basePrice: 3000,
    });

    const req = makeRequest(makeBookingBody());
    const res = await app.request(req);

    expect(res.status).toBe(201);
  });
});

describe("Beta user auto-enrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enrolls user in beta when beta is active and user is logged in", async () => {
    const { isBetaActive } = await import("@/server/api/lib/beta");
    const mockIsBetaActive = isBetaActive as ReturnType<typeof vi.fn>;
    mockIsBetaActive.mockResolvedValue(true);

    const { auth } = await import("@/lib/auth");
    const mockAuth = auth as ReturnType<typeof vi.fn>;
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    mockServiceFindFirst.mockResolvedValue({
      id: TEST_SERVICE_ID,
      name: "Towing",
      slug: "towing",
      schedulingMode: "both",
      basePrice: 5000,
    });

    // Track insert calls
    const mockOnConflictDoNothing = vi.fn(() => Promise.resolve());
    const mockValues = vi.fn(() => ({
      returning: vi.fn(() =>
        Promise.resolve([{
          id: "booking-1",
          userId: "user-1",
          serviceId: "svc-1",
          status: "pending",
          contactName: "Test User",
          scheduledAt: null,
        }])
      ),
      onConflictDoNothing: mockOnConflictDoNothing,
    }));
    const mockInsert = db.insert as ReturnType<typeof vi.fn>;
    mockInsert.mockReturnValue({ values: mockValues });

    const req = makeRequest(makeBookingBody());
    const res = await app.request(req);

    expect(res.status).toBe(201);

    // Wait for fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 50));

    // Verify beta enrollment was attempted
    expect(mockIsBetaActive).toHaveBeenCalled();
  });

  it("does not enroll guest users (no userId)", async () => {
    const { isBetaActive } = await import("@/server/api/lib/beta");
    const mockIsBetaActive = isBetaActive as ReturnType<typeof vi.fn>;
    mockIsBetaActive.mockResolvedValue(true);

    const { auth } = await import("@/lib/auth");
    const mockAuth = auth as ReturnType<typeof vi.fn>;
    mockAuth.mockResolvedValue(null); // guest user

    mockServiceFindFirst.mockResolvedValue({
      id: TEST_SERVICE_ID,
      name: "Towing",
      slug: "towing",
      schedulingMode: "both",
      basePrice: 5000,
    });

    const req = makeRequest(makeBookingBody());
    const res = await app.request(req);

    expect(res.status).toBe(201);

    await new Promise((r) => setTimeout(r, 50));

    // isBetaActive should NOT have been called because userId is null
    expect(mockIsBetaActive).not.toHaveBeenCalled();
  });
});

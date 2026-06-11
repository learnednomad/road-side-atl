import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────

const mockUserFindFirst = vi.fn();
const mockUserUpdate = vi.fn(() => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) }));

vi.mock("@/db", () => ({
  db: {
    query: { users: { findFirst: (...a: unknown[]) => mockUserFindFirst(...a) } },
    update: (...a: unknown[]) => mockUserUpdate(...a),
  },
}));

const mockFlags: Record<string, boolean> = {};
vi.mock("@/server/api/lib/feature-flags", async (importActual) => {
  const actual = await importActual<typeof import("@/server/api/lib/feature-flags")>();
  return { ...actual, isFeatureEnabled: vi.fn(async (f: string) => mockFlags[f] ?? false) };
});

const mockCreateSession = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {},
  getStripe: () => ({ identity: { verificationSessions: { create: mockCreateSession } } }),
}));

// The route module pulls in auth/rate-limit middleware (→ next-auth) just to
// register app.use(); stub them so importing the module doesn't load next-auth.
vi.mock("@/server/api/middleware/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/server/api/middleware/rate-limit", () => ({ rateLimitStrict: vi.fn() }));

import {
  requiresCustomerIdentity,
  isUserIdentityVerified,
  createCustomerIdentitySession,
  IDENTITY_THRESHOLD_CENTS,
} from "@/server/api/routes/payment-methods";
import { FEATURE_FLAGS } from "@/server/api/lib/feature-flags";

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(mockFlags)) delete mockFlags[k];
});

describe("requiresCustomerIdentity", () => {
  it("is false below the threshold regardless of the flag", async () => {
    mockFlags[FEATURE_FLAGS.CUSTOMER_IDENTITY_VERIFICATION] = true;
    expect(await requiresCustomerIdentity(IDENTITY_THRESHOLD_CENTS - 1)).toBe(false);
  });

  it("is false at/above threshold when the flag is off", async () => {
    expect(await requiresCustomerIdentity(IDENTITY_THRESHOLD_CENTS)).toBe(false);
    expect(await requiresCustomerIdentity(IDENTITY_THRESHOLD_CENTS + 100000)).toBe(false);
  });

  it("is true at/above threshold when the flag is on", async () => {
    mockFlags[FEATURE_FLAGS.CUSTOMER_IDENTITY_VERIFICATION] = true;
    expect(await requiresCustomerIdentity(IDENTITY_THRESHOLD_CENTS)).toBe(true);
    expect(await requiresCustomerIdentity(IDENTITY_THRESHOLD_CENTS + 1)).toBe(true);
  });
});

describe("isUserIdentityVerified", () => {
  it("returns the persisted flag", async () => {
    mockUserFindFirst.mockResolvedValue({ identityVerified: true });
    expect(await isUserIdentityVerified("u1")).toBe(true);
  });
  it("defaults to false when the user is missing", async () => {
    mockUserFindFirst.mockResolvedValue(undefined);
    expect(await isUserIdentityVerified("u1")).toBe(false);
  });
});

describe("createCustomerIdentitySession", () => {
  it("creates a document session with the user metadata and persists the session id", async () => {
    mockCreateSession.mockResolvedValue({ id: "vs_123", url: "https://verify.stripe.com/vs_123" });
    const res = await createCustomerIdentitySession("u1");

    expect(res).toEqual({ url: "https://verify.stripe.com/vs_123", sessionId: "vs_123" });
    const arg = mockCreateSession.mock.calls[0][0];
    expect(arg.type).toBe("document");
    expect(arg.metadata).toMatchObject({ userId: "u1", purpose: "high_value_transaction" });
    // session id persisted on the user row
    expect(mockUserUpdate).toHaveBeenCalled();
  });
});

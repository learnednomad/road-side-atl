/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────

const mockSendEmail = vi.fn().mockResolvedValue(undefined);
const mockSendSMS = vi.fn().mockResolvedValue(undefined);
const mockSendPushNotification = vi.fn().mockResolvedValue({ sent: 1, failed: 0 });

const mockProviderFindFirst = vi.fn();
const mockUserFindFirst = vi.fn();
const mockUserFindMany = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      providers: { findFirst: (...args: any[]) => mockProviderFindFirst(...args) },
      users: {
        findFirst: (...args: any[]) => mockUserFindFirst(...args),
        findMany: (...args: any[]) => mockUserFindMany(...args),
      },
    },
  },
}));

vi.mock("@/db/schema/providers", () => ({
  providers: { id: "id", userId: "userId" },
}));

vi.mock("@/db/schema/users", () => ({
  users: { id: "id", role: "role" },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    eq: vi.fn((a, b) => ({ field: a, value: b })),
  };
});

vi.mock("@/lib/notifications/email", () => ({
  sendEmail: (...args: any[]) => mockSendEmail(...args),
  sendBookingConfirmation: vi.fn(),
  sendProviderAssignment: vi.fn(),
  sendStatusUpdate: vi.fn(),
  sendObservationFollowUpEmail: vi.fn(),
  sendReferralCreditEmail: vi.fn(),
  sendPreServiceConfirmationEmail: vi.fn(),
  sendInspectionReportEmail: vi.fn(),
  sendTierPromotionEmail: vi.fn(),
  sendPaymentReceiptEmail: vi.fn(),
  sendB2bServiceDispatchedEmail: vi.fn(),
  sendB2bInvoiceEmail: vi.fn(),
}));

vi.mock("@/lib/notifications/sms", () => ({
  sendSMS: (...args: any[]) => mockSendSMS(...args),
  sendBookingConfirmationSMS: vi.fn(),
  sendProviderAssignmentSMS: vi.fn(),
  sendStatusUpdateSMS: vi.fn(),
  sendObservationFollowUpSMS: vi.fn(),
  sendPreServiceConfirmationSMS: vi.fn(),
  sendReferralSMS: vi.fn(),
  sendReferralCreditSMS: vi.fn(),
  sendTierPromotionSMS: vi.fn(),
  sendB2bServiceDispatchedSMS: vi.fn(),
  sendPaymentReceiptSMS: vi.fn(),
}));

vi.mock("@/lib/notifications/push", () => ({
  sendPushNotification: (...args: any[]) => mockSendPushNotification(...args),
  notifyBookingStatusPush: vi.fn(),
  notifyProviderNewJobPush: vi.fn(),
}));

// ── Import after mocks ──────────────────────────────────────────

import {
  notifyProviderRejected,
  notifyApplicationReceived,
  notifyTrainingCompleted,
  notifyStripeConnectCompleted,
  notifyAdminProviderReadyForReview,
  notifyAdminNewDocumentSubmitted,
  notifyDocumentReviewed,
} from "@/lib/notifications";

// ── Helpers ─────────────────────────────────────────────────────

const mockProvider = { id: "prov-1", userId: "user-1", name: "Test Provider" };
const mockUser = { id: "user-1", name: "Test Provider", email: "test@example.com", phone: "+14045551234", role: "provider" };
const mockAdmin = { id: "admin-1", name: "Admin", email: "admin@roadsidega.com", role: "admin" };

beforeEach(() => {
  vi.clearAllMocks();
  mockProviderFindFirst.mockResolvedValue(mockProvider);
  mockUserFindFirst.mockResolvedValue(mockUser);
  mockUserFindMany.mockResolvedValue([mockAdmin]);
});

// ── Tests ───────────────────────────────────────────────────────

describe("notifyProviderRejected", () => {
  it("sends rejection email with reason", async () => {
    await notifyProviderRejected("prov-1", "Background check failed");

    expect(mockProviderFindFirst).toHaveBeenCalled();
    expect(mockUserFindFirst).toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@example.com",
        subject: "RoadSide GA — Application update",
      }),
    );
  });

  it("includes rejection reason in email body", async () => {
    await notifyProviderRejected("prov-1", "Failed background check");

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.html).toContain("Failed background check");
  });

  it("returns early if provider has no userId", async () => {
    mockProviderFindFirst.mockResolvedValue({ ...mockProvider, userId: null });

    await notifyProviderRejected("prov-1", "reason");

    expect(mockUserFindFirst).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns early if user has no email", async () => {
    mockUserFindFirst.mockResolvedValue({ ...mockUser, email: null });

    await notifyProviderRejected("prov-1", "reason");

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe("notifyApplicationReceived", () => {
  it("sends email with welcome message", async () => {
    await notifyApplicationReceived("user-1", "Marcus", "marcus@example.com", "+14045551234");

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "marcus@example.com",
        subject: expect.stringContaining("Application received"),
      }),
    );
  });

  it("sends SMS when phone provided", async () => {
    await notifyApplicationReceived("user-1", "Marcus", "marcus@example.com", "+14045551234");

    expect(mockSendSMS).toHaveBeenCalledWith(
      "+14045551234",
      expect.stringContaining("application has been received"),
    );
  });

  it("sends push notification", async () => {
    await notifyApplicationReceived("user-1", "Marcus", "marcus@example.com", "+14045551234");

    expect(mockSendPushNotification).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        title: "Application Received!",
      }),
    );
  });

  it("skips SMS when no phone provided", async () => {
    await notifyApplicationReceived("user-1", "Marcus", "marcus@example.com");

    expect(mockSendSMS).not.toHaveBeenCalled();
  });
});

describe("notifyTrainingCompleted", () => {
  it("sends training completion email", async () => {
    await notifyTrainingCompleted("prov-1");

    expect(mockProviderFindFirst).toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("Training complete"),
      }),
    );
  });

  it("returns early if provider not found", async () => {
    mockProviderFindFirst.mockResolvedValue(null);

    await notifyTrainingCompleted("prov-1");

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe("notifyStripeConnectCompleted", () => {
  it("sends Stripe completion email", async () => {
    await notifyStripeConnectCompleted("prov-1");

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Payment setup complete!",
      }),
    );
  });
});

describe("notifyAdminProviderReadyForReview", () => {
  it("sends email to all admin users", async () => {
    await notifyAdminProviderReadyForReview("prov-1", "Marcus");

    expect(mockUserFindMany).toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@roadsidega.com",
        subject: expect.stringContaining("Provider ready for review"),
      }),
    );
  });

  it("includes provider name in email", async () => {
    await notifyAdminProviderReadyForReview("prov-1", "Marcus");

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.html).toContain("Marcus");
  });

  it("skips admins without email", async () => {
    mockUserFindMany.mockResolvedValue([{ ...mockAdmin, email: null }]);

    await notifyAdminProviderReadyForReview("prov-1", "Marcus");

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sends to multiple admins", async () => {
    mockUserFindMany.mockResolvedValue([
      mockAdmin,
      { ...mockAdmin, id: "admin-2", email: "admin2@roadsidega.com" },
    ]);

    await notifyAdminProviderReadyForReview("prov-1", "Marcus");

    expect(mockSendEmail).toHaveBeenCalledTimes(2);
  });
});

describe("notifyAdminNewDocumentSubmitted", () => {
  it("sends email to admin with document type", async () => {
    await notifyAdminNewDocumentSubmitted("prov-1", "Marcus", "insurance");

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("insurance"),
      }),
    );
  });

  it("includes provider name and doc type in body", async () => {
    await notifyAdminNewDocumentSubmitted("prov-1", "Marcus", "certifications");

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.html).toContain("Marcus");
    expect(call.html).toContain("certifications");
  });
});

describe("notifyDocumentReviewed — SMS on rejection (FR57)", () => {
  it("sends SMS when document is rejected and user has phone", async () => {
    await notifyDocumentReviewed("user-1", "insurance", "rejected", "Blurry image");

    expect(mockSendEmail).toHaveBeenCalled();
    expect(mockSendSMS).toHaveBeenCalledWith(
      "+14045551234",
      expect.stringContaining("insurance"),
    );
  });

  it("includes rejection reason in SMS", async () => {
    await notifyDocumentReviewed("user-1", "insurance", "rejected", "Blurry image");

    expect(mockSendSMS).toHaveBeenCalledWith(
      "+14045551234",
      expect.stringContaining("Blurry image"),
    );
  });

  it("does not send SMS when document is approved", async () => {
    await notifyDocumentReviewed("user-1", "insurance", "approved");

    expect(mockSendEmail).toHaveBeenCalled();
    expect(mockSendSMS).not.toHaveBeenCalled();
  });

  it("does not send SMS when user has no phone", async () => {
    mockUserFindFirst.mockResolvedValue({ ...mockUser, phone: null });

    await notifyDocumentReviewed("user-1", "insurance", "rejected", "reason");

    expect(mockSendEmail).toHaveBeenCalled();
    expect(mockSendSMS).not.toHaveBeenCalled();
  });

  it("returns early if userId is undefined", async () => {
    await notifyDocumentReviewed(undefined, "insurance", "rejected", "reason");

    expect(mockUserFindFirst).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test.
// ---------------------------------------------------------------------------

vi.mock("@/db", () => {
  const mockInsertReturning = vi.fn();
  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  const mockReturning = vi.fn();
  const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

  const mockTransaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: mockInsertReturning }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    };
    return cb(tx);
  });

  return {
    db: {
      query: {
        users: { findFirst: vi.fn() },
        providers: { findFirst: vi.fn() },
        providerInvites: { findFirst: vi.fn() },
        onboardingSteps: { findFirst: vi.fn(), findMany: vi.fn() },
        providerDocuments: { findFirst: vi.fn(), findMany: vi.fn() },
      },
      insert: mockInsert,
      update: mockUpdate,
      transaction: mockTransaction,
    },
  };
});

vi.mock("@/db/schema/users", () => ({
  users: { id: "id", email: "email", phone: "phone" },
}));

vi.mock("@/db/schema/providers", () => ({
  providers: { id: "id", email: "email", status: "status" },
}));

vi.mock("@/db/schema/onboarding-steps", () => ({
  onboardingSteps: { id: "id", stepType: "stepType", status: "status", providerId: "providerId" },
}));

vi.mock("@/db/schema/provider-invites", () => ({
  providerInvites: { id: "id", token: "token", usedAt: "usedAt", email: "email" },
}));

vi.mock("@/db/schema/provider-documents", () => ({
  providerDocuments: { id: "id", providerId: "providerId", onboardingStepId: "onboardingStepId", status: "status", createdAt: "createdAt" },
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual("drizzle-orm");
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => ({ _op: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ _op: "and", args })),
    isNull: vi.fn((...args: unknown[]) => ({ _op: "isNull", args })),
    asc: vi.fn((...args: unknown[]) => ({ _op: "asc", args })),
  };
});

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2a$10$hashedpassword"),
  },
}));

vi.mock("@/lib/validators", () => {
  const makeSafeParse = (requiredKeys: string[]) => ({
    safeParse: (data: Record<string, unknown>) => {
      for (const key of requiredKeys) {
        if (data[key] === undefined || data[key] === null || data[key] === "") {
          return { success: false, error: { issues: [{ path: [key], message: `${key} required` }] } };
        }
      }
      return { success: true, data };
    },
  });
  return {
    providerApplicationSchema: makeSafeParse(["name", "email", "password", "phone", "serviceArea"]),
    inviteAcceptSchema: makeSafeParse(["inviteToken", "password", "phone", "serviceArea"]),
    providerStepUpdateSchema: {
      safeParse: (data: Record<string, unknown>) => {
        if (!data.status || !["draft", "in_progress"].includes(data.status as string)) {
          return { success: false, error: { issues: [{ path: ["status"], message: "Invalid status" }] } };
        }
        return { success: true, data };
      },
    },
    documentUploadUrlSchema: {
      safeParse: (data: Record<string, unknown>) => {
        const validDocTypes = ["insurance", "certification", "vehicle_doc"];
        const validMimeTypes = ["image/png", "image/jpeg", "image/webp"];
        if (!data.documentType || !validDocTypes.includes(data.documentType as string)) {
          return { success: false, error: { issues: [{ path: ["documentType"], message: "Invalid document type" }] } };
        }
        if (!data.mimeType || !validMimeTypes.includes(data.mimeType as string)) {
          return { success: false, error: { issues: [{ path: ["mimeType"], message: "Invalid mime type" }] } };
        }
        if (!data.fileName) {
          return { success: false, error: { issues: [{ path: ["fileName"], message: "fileName required" }] } };
        }
        return { success: true, data };
      },
    },
    documentCreateSchema: {
      safeParse: (data: Record<string, unknown>) => {
        const validDocTypes = ["insurance", "certification", "vehicle_doc"];
        const validMimeTypes = ["image/png", "image/jpeg", "image/webp"];
        if (!data.s3Key) return { success: false, error: { issues: [{ path: ["s3Key"], message: "s3Key required" }] } };
        if (!data.documentType || !validDocTypes.includes(data.documentType as string)) {
          return { success: false, error: { issues: [{ path: ["documentType"], message: "Invalid document type" }] } };
        }
        if (!data.originalFileName) return { success: false, error: { issues: [{ path: ["originalFileName"], message: "required" }] } };
        if (!data.fileSize || (data.fileSize as number) > 10485760) {
          return { success: false, error: { issues: [{ path: ["fileSize"], message: "Invalid file size" }] } };
        }
        if (!data.mimeType || !validMimeTypes.includes(data.mimeType as string)) {
          return { success: false, error: { issues: [{ path: ["mimeType"], message: "Invalid mime type" }] } };
        }
        if (!data.onboardingStepId) return { success: false, error: { issues: [{ path: ["onboardingStepId"], message: "required" }] } };
        return { success: true, data };
      },
    },
  };
});

vi.mock("@/lib/constants", () => ({
  ONBOARDING_STEP_TYPES: ["background_check", "insurance", "certifications", "training", "stripe_connect"],
  REAPPLY_COOLDOWN_DAYS: 30,
  PRESIGNED_UPLOAD_EXPIRY: 900,
  PRESIGNED_DOWNLOAD_EXPIRY_PROVIDER: 3600,
  MIN_DOCUMENTS_PER_STEP: { insurance: 1, certifications: 1, vehicle_doc: 0 },
}));

vi.mock("@/server/api/middleware/rate-limit", () => ({
  rateLimitStrict: vi.fn((_c: unknown, next: () => Promise<void>) => next()),
}));

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/server/api/lib/audit-logger", () => ({
  logAudit: vi.fn(),
  getRequestInfo: vi.fn().mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "test" }),
}));

vi.mock("@/server/websocket/broadcast", () => ({
  broadcastToUser: vi.fn(),
  broadcastToAdmins: vi.fn(),
}));

vi.mock("@/server/api/lib/onboarding-state-machine", async () => {
  const actual = await vi.importActual("@/server/api/lib/onboarding-state-machine");
  return actual;
});

vi.mock("@/lib/s3", () => ({
  getPresignedUploadUrl: vi.fn().mockResolvedValue("https://s3.example.com/upload?signed=true"),
  getPresignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/download?signed=true"),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { db } from "@/db";
import app from "@/server/api/routes/onboarding";
import { logAudit } from "@/server/api/lib/audit-logger";
import { broadcastToAdmins } from "@/server/websocket/broadcast";
import { getPresignedUploadUrl, getPresignedUrl } from "@/lib/s3";

const mockProvidersFindFirst = db.query.providers.findFirst as ReturnType<typeof vi.fn>;
const mockOnboardingStepsFindFirst = (db.query as unknown as { onboardingSteps: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> } }).onboardingSteps.findFirst;
const mockOnboardingStepsFindMany = (db.query as unknown as { onboardingSteps: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> } }).onboardingSteps.findMany;
const mockDocsFindFirst = (db.query as unknown as { providerDocuments: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> } }).providerDocuments.findFirst;
const mockDocsFindMany = (db.query as unknown as { providerDocuments: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> } }).providerDocuments.findMany;
const mockDbInsert = db.insert as ReturnType<typeof vi.fn>;
const mockDbUpdate = db.update as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;
const mockBroadcastToAdmins = broadcastToAdmins as ReturnType<typeof vi.fn>;
const mockGetPresignedUploadUrl = getPresignedUploadUrl as ReturnType<typeof vi.fn>;
const mockGetPresignedUrl = getPresignedUrl as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePost(path: string, body: Record<string, unknown>) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGet(path: string) {
  return new Request(`http://localhost${path}`, { method: "GET" });
}

const mockProvider = { id: "p1", name: "Test Provider", userId: "u1", status: "onboarding" };

// ---------------------------------------------------------------------------
// Tests — POST /upload-url
// ---------------------------------------------------------------------------

describe("POST /upload-url — Generate Presigned Upload URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "provider", name: "Test Provider" } });
    mockProvidersFindFirst.mockResolvedValue(mockProvider);
  });

  it("returns presigned URL, s3Key, and expiresIn on valid request", async () => {
    const res = await app.fetch(makePost("/upload-url", {
      documentType: "insurance",
      mimeType: "image/jpeg",
      fileName: "insurance-card.jpg",
    }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.uploadUrl).toBe("https://s3.example.com/upload?signed=true");
    expect(json.s3Key).toMatch(/^onboarding\/p1\/insurance\/\d+\.jpg$/);
    expect(json.expiresIn).toBe(900);
    expect(mockGetPresignedUploadUrl).toHaveBeenCalledWith(
      expect.stringContaining("onboarding/p1/insurance/"),
      "image/jpeg",
      900,
    );
  });

  it("returns 400 for invalid documentType", async () => {
    const res = await app.fetch(makePost("/upload-url", {
      documentType: "invalid_type",
      mimeType: "image/jpeg",
      fileName: "test.jpg",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid mimeType", async () => {
    const res = await app.fetch(makePost("/upload-url", {
      documentType: "insurance",
      mimeType: "application/pdf",
      fileName: "test.pdf",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 401 for unauthenticated request", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await app.fetch(makePost("/upload-url", {
      documentType: "insurance",
      mimeType: "image/jpeg",
      fileName: "test.jpg",
    }));
    expect(res.status).toBe(401);
  });

  it("returns 404 when provider not found", async () => {
    mockProvidersFindFirst.mockResolvedValue(null);

    const res = await app.fetch(makePost("/upload-url", {
      documentType: "insurance",
      mimeType: "image/jpeg",
      fileName: "test.jpg",
    }));
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Tests — POST /documents
// ---------------------------------------------------------------------------

describe("POST /documents — Create Document Record", () => {
  const validDocData = {
    s3Key: "onboarding/p1/insurance/12345.jpg",
    documentType: "insurance",
    originalFileName: "insurance-card.jpg",
    fileSize: 1024000,
    mimeType: "image/jpeg",
    onboardingStepId: "step-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "provider", name: "Test Provider" } });
    mockProvidersFindFirst.mockResolvedValue(mockProvider);
    mockOnboardingStepsFindFirst.mockResolvedValue({
      id: "step-1", stepType: "insurance", status: "pending", providerId: "p1",
    });

    // Setup insert chain
    const mockReturning = vi.fn().mockResolvedValue([{
      id: "doc-1", ...validDocData, providerId: "p1", status: "pending_review",
    }]);
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
    mockDbInsert.mockReturnValue({ values: mockValues });
  });

  it("creates document record on valid request", async () => {
    const res = await app.fetch(makePost("/documents", validDocData));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.id).toBe("doc-1");
    expect(json.status).toBe("pending_review");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "document.uploaded",
        resourceType: "provider_document",
        resourceId: "doc-1",
      }),
    );
  });

  it("returns 400 for invalid mimeType", async () => {
    const res = await app.fetch(makePost("/documents", {
      ...validDocData,
      mimeType: "application/pdf",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for oversized file", async () => {
    const res = await app.fetch(makePost("/documents", {
      ...validDocData,
      fileSize: 20 * 1024 * 1024, // 20MB
    }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when onboarding step not found", async () => {
    mockOnboardingStepsFindFirst.mockResolvedValue(null);

    const res = await app.fetch(makePost("/documents", validDocData));
    expect(res.status).toBe(404);
  });

  it("returns 401 for unauthenticated request", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await app.fetch(makePost("/documents", validDocData));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests — GET /documents
// ---------------------------------------------------------------------------

describe("GET /documents — List Provider Documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "provider", name: "Test Provider" } });
    mockProvidersFindFirst.mockResolvedValue(mockProvider);
  });

  it("returns documents grouped by step", async () => {
    mockDocsFindMany.mockResolvedValue([
      { id: "doc-1", onboardingStepId: "step-1", documentType: "insurance", status: "pending_review" },
      { id: "doc-2", onboardingStepId: "step-1", documentType: "insurance", status: "approved" },
      { id: "doc-3", onboardingStepId: "step-2", documentType: "certification", status: "rejected" },
    ]);

    const res = await app.fetch(makeGet("/documents"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.documents["step-1"]).toHaveLength(2);
    expect(json.documents["step-2"]).toHaveLength(1);
  });

  it("returns empty when no documents", async () => {
    mockDocsFindMany.mockResolvedValue([]);

    const res = await app.fetch(makeGet("/documents"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.documents).toEqual({});
  });

  it("returns 404 when provider not found", async () => {
    mockProvidersFindFirst.mockResolvedValue(null);

    const res = await app.fetch(makeGet("/documents"));
    expect(res.status).toBe(404);
  });

  it("returns 401 for unauthenticated request", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await app.fetch(makeGet("/documents"));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests — GET /documents/:documentId/url
// ---------------------------------------------------------------------------

describe("GET /documents/:documentId/url — Presigned Download URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "provider", name: "Test Provider" } });
    mockProvidersFindFirst.mockResolvedValue(mockProvider);
  });

  it("returns presigned download URL for provider's own document", async () => {
    mockDocsFindFirst.mockResolvedValue({
      id: "doc-1", s3Key: "onboarding/p1/insurance/12345.jpg", providerId: "p1",
    });

    const res = await app.fetch(makeGet("/documents/doc-1/url"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.downloadUrl).toBe("https://s3.example.com/download?signed=true");
    expect(json.expiresIn).toBe(3600);
    expect(mockGetPresignedUrl).toHaveBeenCalledWith(
      "onboarding/p1/insurance/12345.jpg",
      3600,
    );
  });

  it("returns 404 when document not found or not owned by provider", async () => {
    mockDocsFindFirst.mockResolvedValue(null);

    const res = await app.fetch(makeGet("/documents/doc-999/url"));
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Tests — POST /steps/:stepId/submit
// ---------------------------------------------------------------------------

describe("POST /steps/:stepId/submit — Submit Documents for Review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "provider", name: "Test Provider" } });
    mockProvidersFindFirst.mockResolvedValue(mockProvider);
  });

  it("transitions step to in_progress when minimum docs met", async () => {
    mockOnboardingStepsFindFirst.mockResolvedValue({
      id: "step-1", stepType: "insurance", status: "pending", providerId: "p1",
    });
    mockDocsFindMany.mockResolvedValue([
      { id: "doc-1", onboardingStepId: "step-1", providerId: "p1" },
    ]);

    const mockReturning = vi.fn().mockResolvedValue([{
      id: "step-1", status: "in_progress",
    }]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    mockDbUpdate.mockReturnValue({ set: mockSet });

    const res = await app.fetch(makePost("/steps/step-1/submit", {}));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("in_progress");

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "onboarding.step_started",
        details: expect.objectContaining({
          stepType: "insurance",
          trigger: "document_submission",
        }),
      }),
    );

    expect(mockBroadcastToAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "onboarding:new_submission",
        data: expect.objectContaining({
          providerId: "p1",
          stepType: "insurance",
        }),
      }),
    );
  });

  it("rejects when no documents uploaded", async () => {
    mockOnboardingStepsFindFirst.mockResolvedValue({
      id: "step-1", stepType: "insurance", status: "pending", providerId: "p1",
    });
    mockDocsFindMany.mockResolvedValue([]);

    const res = await app.fetch(makePost("/steps/step-1/submit", {}));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain("document(s) required");
  });

  it("rejects non-document step types", async () => {
    mockOnboardingStepsFindFirst.mockResolvedValue({
      id: "step-1", stepType: "training", status: "pending", providerId: "p1",
    });

    const res = await app.fetch(makePost("/steps/step-1/submit", {}));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain("does not support document submission");
  });

  it("rejects invalid step transition", async () => {
    mockOnboardingStepsFindFirst.mockResolvedValue({
      id: "step-1", stepType: "insurance", status: "complete", providerId: "p1",
    });

    const res = await app.fetch(makePost("/steps/step-1/submit", {}));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain("Invalid step transition");
  });

  it("returns 404 when step not found", async () => {
    mockOnboardingStepsFindFirst.mockResolvedValue(null);

    const res = await app.fetch(makePost("/steps/step-999/submit", {}));
    expect(res.status).toBe(404);
  });

  it("works for certifications step type", async () => {
    mockOnboardingStepsFindFirst.mockResolvedValue({
      id: "step-2", stepType: "certifications", status: "draft", providerId: "p1",
    });
    mockDocsFindMany.mockResolvedValue([
      { id: "doc-1", onboardingStepId: "step-2", providerId: "p1" },
    ]);

    const mockReturning = vi.fn().mockResolvedValue([{
      id: "step-2", status: "in_progress",
    }]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    mockDbUpdate.mockReturnValue({ set: mockSet });

    const res = await app.fetch(makePost("/steps/step-2/submit", {}));
    expect(res.status).toBe(200);
  });
});

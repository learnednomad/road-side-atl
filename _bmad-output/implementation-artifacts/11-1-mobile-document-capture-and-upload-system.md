# Story 11.1: Mobile Document Capture and Upload System

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a provider completing onboarding,
I want to upload required documents (insurance, certifications, vehicle documentation) using my phone's camera with a preview before submitting, see per-document status independently, and re-upload after rejection with the rejection reason visible,
so that I can complete the document upload onboarding step quickly from my mobile device with confidence that my submissions are valid.

## Acceptance Criteria

1. **Given** a provider on the onboarding dashboard with an `insurance` or `certifications` step in status `pending` or `draft`, **When** the provider navigates to the document upload page for that step, **Then** a mobile-optimized document capture interface is displayed showing document-type-specific guidance (what a valid document looks like), a camera capture button using `accept="image/*" capture="environment"`, and a list of any previously uploaded documents for this step with their individual statuses.

2. **Given** the provider captures or selects a photo, **When** the image is selected, **Then** the provider sees a preview of the captured photo with "Retake" and "Submit" buttons, and the image is compressed client-side to target < 2MB before upload is initiated.

3. **Given** the provider taps "Submit" on the preview, **When** the upload is initiated, **Then** the system requests a presigned S3 upload URL from `POST /api/provider/onboarding/upload-url` (passing `documentType`, `mimeType`, `fileName`), uploads the file directly to S3 via `PUT` to the presigned URL, and on successful upload creates a `provider_documents` record via `POST /api/provider/onboarding/documents` with the S3 key, original file name, file size, and MIME type.

4. **Given** a presigned upload URL is requested, **When** the server generates the URL, **Then** the URL expires within 15 minutes (NFR-S2), the S3 key follows the pattern `onboarding/{providerId}/{documentType}/{timestamp}.{ext}`, the response includes `{ uploadUrl, s3Key, expiresIn }`, and `logAudit("document.uploaded")` is recorded after successful document creation.

5. **Given** the upload fails due to network error, **When** the client detects the failure, **Then** the system automatically retries up to 3 times with exponential backoff (1s, 3s, 9s), and if all retries fail shows "Upload failed. Please check your connection and try again." with a manual retry button.

6. **Given** a provider has uploaded documents for a step, **When** viewing the document upload page, **Then** each document is shown as an individual card with its own status: "Pending Review" (yellow), "Approved" (green), or "Rejected" (red) with the rejection reason visible below.

7. **Given** a document has been rejected by admin with a reason, **When** the provider views the rejected document, **Then** the rejection reason is clearly displayed, a "Re-upload" button is available, and tapping it opens the camera capture flow to submit a replacement document. The re-uploaded document creates a new `provider_documents` row (the rejected row remains for audit history), and `logAudit("document.resubmitted")` is recorded.

8. **Given** a provider uploads a file, **When** the server processes the document creation request, **Then** the server validates: file MIME type is in `ALLOWED_IMAGE_TYPES` (PNG, JPEG, WebP), file size <= 10MB (raw, pre-compression), and `documentType` matches one of the valid `DOCUMENT_TYPES` from constants. Invalid files are rejected with a 400 error.

9. **Given** the provider has uploaded all required documents for a step (insurance: at least 1 document, certifications: at least 1 document), **When** all documents for the step are uploaded, **Then** the corresponding `onboarding_steps` record transitions from `pending`/`draft` to `in_progress` (submitted for review) via the step state machine, a `onboarding:new_submission` WebSocket event is broadcast to admins with `{ providerId, providerName, stepType }`, and `logAudit("onboarding.step_started")` is recorded if this is the first submission.

10. **Given** an admin reviews a document via the existing `PATCH /api/admin/providers/:id/steps/:stepId` endpoint, **When** the admin approves or rejects the document, **Then** the individual `provider_documents` record is updated (status, reviewedBy, reviewedAt, rejectionReason if rejected), `logAudit("document.approved")` or `logAudit("document.rejected")` is recorded, a `onboarding:document_reviewed` WebSocket event is broadcast to the provider, and a fire-and-forget notification is sent via `notifyDocumentReviewed(providerId, docType, status, reason?).catch(err => { console.error("[Notifications] Failed:", err); })`.

11. **Given** the admin approves all documents for a step, **When** the last document is approved, **Then** the `onboarding_steps` record for that step transitions to `complete` via the step state machine, `logAudit("onboarding.step_completed")` is recorded, and the dashboard auto-transition check runs (if all steps now complete, provider → `pending_review`).

12. **Given** presigned download URLs are needed for admin document review, **When** the admin requests to view a document, **Then** the presigned download URL expires within 10 minutes (NFR-S3), and document URLs are scoped — only the owning provider and admins can access them (NFR-S9).

## Tasks / Subtasks

- [x] Task 1: Add document upload API endpoints to `onboarding.ts` (AC: 3, 4, 8)
  - [x] 1.1 Add `POST /upload-url` — generates presigned S3 upload URL with key pattern `onboarding/{providerId}/{documentType}/{timestamp}.{ext}`, validates `documentType` and `mimeType`, returns `{ uploadUrl, s3Key, expiresIn: 900 }`, requires `requireProvider`
  - [x] 1.2 Add `POST /documents` — creates `provider_documents` row after successful S3 upload, validates `s3Key`, `documentType`, `originalFileName`, `fileSize`, `mimeType` via Zod, links to provider and onboarding step, calls `logAudit("document.uploaded")`, returns created document
  - [x] 1.3 Add `GET /documents` — returns all documents for the authenticated provider grouped by step, includes per-document status and rejection reason
  - [x] 1.4 Add `GET /documents/:documentId/url` — generates presigned download URL (1 hour expiry) for provider to view their own uploaded document, validates document belongs to authenticated provider

- [x] Task 2: Add admin document review endpoints to `admin-providers.ts` (AC: 10, 11, 12)
  - [x] 2.1 Add `GET /:id/documents` — returns all documents for a provider, grouped by document type, with presigned download URLs (10 min expiry per NFR-S3)
  - [x] 2.2 Add `PATCH /:id/documents/:documentId` — admin approves or rejects a document, validates via `adminDocumentReviewSchema`, updates `provider_documents` row (status, reviewedBy, reviewedAt, rejectionReason), calls `logAudit("document.approved"/"document.rejected")`, broadcasts `onboarding:document_reviewed` WebSocket event, sends fire-and-forget notification
  - [x] 2.3 Add auto-complete check in document review: when last document for a step is approved, transition `onboarding_steps` record to `complete` via `isValidStepTransition()`, then run all-steps-complete auto-transition check for provider status

- [x] Task 3: Add step submission endpoint (AC: 9)
  - [x] 3.1 Add `POST /steps/:stepId/submit` to `onboarding.ts` — transitions insurance/certifications step from `pending`/`draft` to `in_progress` when provider has uploaded required documents, validates minimum document count, broadcasts `onboarding:new_submission` to admins, calls `logAudit("onboarding.step_started")`

- [x] Task 4: Add Zod validators (AC: 3, 4, 8, 10)
  - [x] 4.1 Add `documentUploadUrlSchema` — `{ documentType: z.enum(DOCUMENT_TYPES), mimeType: z.enum(ALLOWED_IMAGE_TYPES), fileName: z.string().min(1) }`
  - [x] 4.2 Add `documentCreateSchema` — `{ s3Key: z.string().min(1), documentType: z.enum(DOCUMENT_TYPES), originalFileName: z.string().min(1), fileSize: z.number().int().positive().max(10485760), mimeType: z.enum(ALLOWED_IMAGE_TYPES), onboardingStepId: z.string().min(1) }`
  - [x] 4.3 Add `adminDocumentReviewSchema` — `{ status: z.enum(["approved", "rejected"]), rejectionReason: z.string().min(1).optional() }.refine(val => val.status !== "rejected" || (val.rejectionReason && val.rejectionReason.length > 0), { message: "Rejection reason required" })`

- [x] Task 5: Add audit action types (AC: 4, 7, 10)
  - [x] 5.1 Add `document.uploaded`, `document.approved`, `document.rejected`, `document.resubmitted` to `AuditAction` type in `audit-logger.ts`

- [x] Task 6: Add document upload constants (AC: 8)
  - [x] 6.1 Add `PRESIGNED_UPLOAD_EXPIRY = 900` (15 minutes) to `lib/constants.ts`
  - [x] 6.2 Add `PRESIGNED_DOWNLOAD_EXPIRY_ADMIN = 600` (10 minutes) to `lib/constants.ts`
  - [x] 6.3 Add `PRESIGNED_DOWNLOAD_EXPIRY_PROVIDER = 3600` (1 hour) to `lib/constants.ts`
  - [x] 6.4 Add `MAX_UPLOAD_SIZE = 10 * 1024 * 1024` (10MB raw) to `lib/constants.ts`
  - [x] 6.5 Add `MIN_DOCUMENTS_PER_STEP: Record<string, number>` — `{ insurance: 1, certifications: 1, vehicle_doc: 0 }`

- [x] Task 7: Create mobile-first document upload UI components (AC: 1, 2, 5, 6, 7)
  - [x] 7.1 Create `components/onboarding/document-uploader.tsx` — mobile-first camera capture component using `accept="image/*" capture="environment"` on file input, client-side image compression targeting < 2MB, presigned URL upload with 3x exponential backoff retry (1s, 3s, 9s), visual upload progress state, document-type-specific guidance text before capture
  - [x] 7.2 Create `components/onboarding/document-preview.tsx` — photo preview modal with captured image display, "Retake" button (re-opens camera), "Submit" button (initiates compressed upload), loading state during compression + upload
  - [x] 7.3 Create `components/onboarding/document-card.tsx` — individual document status card showing document name, upload date, status badge (Pending Review/yellow, Approved/green, Rejected/red), rejection reason text when rejected, "Re-upload" button for rejected documents, presigned download thumbnail/link for viewing
  - [x] 7.4 Create `app/(provider)/provider/onboarding/documents/page.tsx` — document upload page with guidance per document type, upload interface per required document type (insurance, certifications), list of uploaded documents per type with individual statuses, "Submit for Review" button when minimum documents uploaded

- [x] Task 8: Add WebSocket event types (AC: 9, 10)
  - [x] 8.1 Add `onboarding:document_reviewed` and `onboarding:new_submission` event types to `server/websocket/types.ts`

- [x] Task 9: Wire notification for document review (AC: 10)
  - [x] 9.1 Add `notifyDocumentReviewed(providerId, docType, status, reason?)` to `lib/notifications/index.ts` using existing email + push notification patterns — fire-and-forget with `.catch(err => { console.error("[Notifications] Failed:", err); })`

- [x] Task 10: Write tests (AC: 1-12)
  - [x] 10.1 Unit tests for `POST /upload-url`: valid request returns presigned URL + s3Key + expiresIn, invalid documentType returns 400, invalid mimeType returns 400, unauthenticated returns 401
  - [x] 10.2 Unit tests for `POST /documents`: valid request creates provider_documents row, logs audit, validates s3Key format, rejects oversized files (>10MB), rejects invalid mimeType
  - [x] 10.3 Unit tests for `GET /documents`: returns provider's documents grouped by step, does NOT return other providers' documents
  - [x] 10.4 Unit tests for admin `GET /:id/documents`: returns all documents with presigned URLs, presigned URLs have 10-min expiry
  - [x] 10.5 Unit tests for admin `PATCH /:id/documents/:documentId`: approve sets status + reviewedBy + reviewedAt, reject requires reason, reject without reason returns 400, invalid document returns 404, broadcasts WebSocket event, logs audit
  - [x] 10.6 Unit tests for auto-complete: approving last document transitions step to complete, step completion triggers provider auto-transition check
  - [x] 10.7 Unit tests for `POST /steps/:stepId/submit`: transitions step to in_progress when minimum docs met, rejects when no docs uploaded, broadcasts admin notification

## Dev Notes

### Technical Requirements

**Presigned Upload URL Endpoint — `POST /upload-url`:**
```typescript
// In server/api/routes/onboarding.ts
app.post("/upload-url", requireProvider, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = documentUploadUrlSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);

  const provider = await db.query.providers.findFirst({ where: eq(providers.userId, user.id) });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  const ext = parsed.data.fileName.split(".").pop() || "jpg";
  const s3Key = `onboarding/${provider.id}/${parsed.data.documentType}/${Date.now()}.${ext}`;

  const uploadUrl = await getPresignedUploadUrl(s3Key, parsed.data.mimeType, PRESIGNED_UPLOAD_EXPIRY);

  return c.json({ uploadUrl, s3Key, expiresIn: PRESIGNED_UPLOAD_EXPIRY }, 200);
});
```

**Document Creation Endpoint — `POST /documents`:**
```typescript
app.post("/documents", requireProvider, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = documentCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);

  const provider = await db.query.providers.findFirst({ where: eq(providers.userId, user.id) });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  // Verify onboarding step belongs to this provider
  const step = await db.query.onboardingSteps.findFirst({
    where: and(
      eq(onboardingSteps.id, parsed.data.onboardingStepId),
      eq(onboardingSteps.providerId, provider.id),
    ),
  });
  if (!step) return c.json({ error: "Onboarding step not found" }, 404);

  const [doc] = await db.insert(providerDocuments).values({
    providerId: provider.id,
    onboardingStepId: parsed.data.onboardingStepId,
    documentType: parsed.data.documentType,
    s3Key: parsed.data.s3Key,
    originalFileName: parsed.data.originalFileName,
    fileSize: parsed.data.fileSize,
    mimeType: parsed.data.mimeType,
    status: "pending_review",
  }).returning();

  await logAudit({
    action: "document.uploaded",
    userId: user.id,
    resourceType: "provider_document",
    resourceId: doc.id,
    metadata: { providerId: provider.id, documentType: parsed.data.documentType, stepId: step.id },
  });

  return c.json(doc, 201);
});
```

**Admin Document Review Endpoint — `PATCH /:id/documents/:documentId`:**
```typescript
// In server/api/routes/admin-providers.ts
app.patch("/:id/documents/:documentId", async (c) => {
  const { id, documentId } = c.req.param();
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = adminDocumentReviewSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);

  const doc = await db.query.providerDocuments.findFirst({
    where: and(eq(providerDocuments.id, documentId), eq(providerDocuments.providerId, id)),
  });
  if (!doc) return c.json({ error: "Document not found" }, 404);
  if (doc.status !== "pending_review") {
    return c.json({ error: `Cannot review document with status: ${doc.status}` }, 400);
  }

  const updateData: Record<string, unknown> = {
    status: parsed.data.status,
    reviewedBy: user.id,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  };
  if (parsed.data.status === "rejected") {
    updateData.rejectionReason = parsed.data.rejectionReason;
  }
  if (parsed.data.status === "approved") {
    updateData.rejectionReason = null; // Clear any previous rejection
  }

  const [updated] = await db.update(providerDocuments)
    .set(updateData)
    .where(eq(providerDocuments.id, documentId))
    .returning();

  const auditAction = parsed.data.status === "approved" ? "document.approved" : "document.rejected";
  await logAudit({
    action: auditAction,
    userId: user.id,
    resourceType: "provider_document",
    resourceId: documentId,
    metadata: {
      providerId: id,
      documentType: doc.documentType,
      ...(parsed.data.rejectionReason && { reason: parsed.data.rejectionReason }),
    },
  });

  // Broadcast WebSocket event
  const provider = await db.query.providers.findFirst({ where: eq(providers.id, id) });
  if (provider) {
    broadcastToUser(provider.userId, {
      type: "onboarding:document_reviewed",
      data: {
        providerId: id,
        documentType: doc.documentType,
        status: parsed.data.status,
        ...(parsed.data.rejectionReason && { rejectionReason: parsed.data.rejectionReason }),
      },
    });
  }

  // Fire-and-forget notification
  notifyDocumentReviewed(provider?.userId, doc.documentType, parsed.data.status, parsed.data.rejectionReason)
    .catch((err) => { console.error("[Notifications] Failed:", err); });

  // Auto-complete check: if all docs for this step are now approved
  if (parsed.data.status === "approved") {
    const stepDocs = await db.query.providerDocuments.findMany({
      where: and(
        eq(providerDocuments.onboardingStepId, doc.onboardingStepId),
        eq(providerDocuments.providerId, id),
      ),
    });
    const allApproved = stepDocs.every((d) =>
      d.id === documentId ? true : d.status === "approved"
    );
    if (allApproved) {
      const step = await db.query.onboardingSteps.findFirst({
        where: eq(onboardingSteps.id, doc.onboardingStepId),
      });
      if (step && isValidStepTransition(step.status, "complete")) {
        await db.update(onboardingSteps).set({
          status: "complete",
          completedAt: new Date(),
          reviewedBy: user.id,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(onboardingSteps.id, doc.onboardingStepId));

        await logAudit({
          action: "onboarding.step_completed",
          userId: user.id,
          resourceType: "onboarding_step",
          resourceId: doc.onboardingStepId,
          metadata: { providerId: id, stepType: step.stepType, trigger: "all_documents_approved" },
        });

        // Run all-steps-complete auto-transition check
        if (provider?.status === "onboarding") {
          const allSteps = await db.query.onboardingSteps.findMany({
            where: eq(onboardingSteps.providerId, id),
          });
          const allComplete = allSteps.every((s) =>
            s.id === doc.onboardingStepId ? true : s.status === "complete"
          );
          if (allComplete) {
            await db.update(providers).set({
              status: "pending_review",
              updatedAt: new Date(),
            }).where(and(eq(providers.id, id), eq(providers.status, "onboarding")));
          }
        }
      }
    }
  }

  return c.json(updated, 200);
});
```

**Client-Side Image Compression Pattern:**
```typescript
// In components/onboarding/document-uploader.tsx
async function compressImage(file: File, targetSizeKB: number = 2048): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      // Scale down if very large
      const maxDimension = 2048;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      // Start at 0.8 quality, reduce until under target
      let quality = 0.8;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            if (blob.size <= targetSizeKB * 1024 || quality <= 0.3) {
              resolve(blob);
            } else {
              quality -= 0.1;
              tryCompress();
            }
          },
          "image/jpeg",
          quality,
        );
      };
      tryCompress();
    };
    img.src = URL.createObjectURL(file);
  });
}
```

**Upload with Exponential Backoff:**
```typescript
async function uploadToS3(url: string, blob: Blob, mimeType: string): Promise<void> {
  const delays = [1000, 3000, 9000]; // exponential backoff

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await fetch(url, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": mimeType },
      });
      if (res.ok) return;
      throw new Error(`Upload failed: ${res.status}`);
    } catch (error) {
      if (attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      } else {
        throw error;
      }
    }
  }
}
```

### Architecture Compliance

| Rule | Compliance |
|---|---|
| All API routes via Hono, NOT app/api/ | All endpoints added to existing `onboarding.ts` and `admin-providers.ts` Hono modules |
| Zod v4: `import { z } from "zod/v4"` | All new validators use correct import |
| `updatedAt: new Date()` in every `.update().set()` | Included in every update operation |
| Destructure `.returning()` | `const [result] = await db.update(...).returning()` everywhere |
| Audit logging for ALL state changes | `logAudit()` on every document upload, review, step transition |
| Named exports | All component and function exports are named |
| `@/` path alias for all imports | Consistent throughout |
| Fire-and-forget notifications | `.catch((err) => { console.error("[Notifications] Failed:", err); })` pattern |
| S3 no public-read ACL | All uploads via presigned URLs, no public bucket access |
| Server-side file validation | MIME type validated on presigned URL generation, magic bytes NOT needed for presigned-URL flow (S3 receives directly from client) |
| Presigned URL expiry per NFR | Upload: 15 min (NFR-S2), Admin download: 10 min (NFR-S3) |
| Document access scoping (NFR-S9) | Provider endpoint validates document ownership, admin endpoint validates provider existence |
| State machine transitions | Step transitions via `isValidStepTransition()` from `onboarding-state-machine.ts` |
| Transaction for multi-table writes | Auto-complete check uses sequential queries (acceptable — step completion is idempotent via TOCTOU WHERE clause) |
| Components in `components/onboarding/` | New upload components in dedicated onboarding folder per architecture |
| Document endpoints in `onboarding.ts` | Per architecture: "No `server/api/routes/provider-documents.ts` — document endpoints go in `onboarding.ts`" |

### Library & Framework Requirements

| Library | Version | Usage in This Story |
|---|---|---|
| Hono | ^4.11.7 | 4 new provider endpoints + 2 new admin endpoints |
| Drizzle ORM | ^0.45.1 | Insert + query + update providerDocuments and onboardingSteps |
| Zod | ^4.3.6 | `import { z } from "zod/v4"` — 3 new validators |
| @aws-sdk/client-s3 | existing | `PutObjectCommand`, `GetObjectCommand` |
| @aws-sdk/s3-request-presigner | existing | `getSignedUrl` for presigned URLs |
| Vitest | ^4.0.18 | Unit tests for all endpoints |
| ws | ^8.19.0 | `broadcastToUser()` for WebSocket events (existing pattern) |

**No new npm dependencies required.** All libraries already installed. `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` already in use for existing logo upload.

### File Structure Requirements

**New files (4):**
- `components/onboarding/document-uploader.tsx` — Mobile-first camera capture + compression + upload
- `components/onboarding/document-preview.tsx` — Photo preview with retake/submit
- `components/onboarding/document-card.tsx` — Individual document status card
- `app/(provider)/provider/onboarding/documents/page.tsx` — Document upload page

**Modified files (5):**
- `server/api/routes/onboarding.ts` — Add 4 new endpoints: `POST /upload-url`, `POST /documents`, `GET /documents`, `GET /documents/:documentId/url`, `POST /steps/:stepId/submit`
- `server/api/routes/admin-providers.ts` — Add 2 new endpoints: `GET /:id/documents`, `PATCH /:id/documents/:documentId`
- `lib/validators.ts` — Add 3 new schemas: `documentUploadUrlSchema`, `documentCreateSchema`, `adminDocumentReviewSchema`
- `lib/constants.ts` — Add `PRESIGNED_UPLOAD_EXPIRY`, `PRESIGNED_DOWNLOAD_EXPIRY_ADMIN`, `PRESIGNED_DOWNLOAD_EXPIRY_PROVIDER`, `MAX_UPLOAD_SIZE`, `MIN_DOCUMENTS_PER_STEP`
- `server/api/lib/audit-logger.ts` — Add 4 new audit action types: `document.uploaded`, `document.approved`, `document.rejected`, `document.resubmitted`

**Modified type files (1):**
- `server/websocket/types.ts` — Add `onboarding:document_reviewed` and `onboarding:new_submission` event types

**New test files (2):**
- `tests/unit/onboarding-documents.test.ts` — Provider document endpoint tests
- `tests/unit/onboarding-admin-documents.test.ts` — Admin document review endpoint tests

**What NOT to create:**
- No `server/api/routes/provider-documents.ts` — document endpoints go in existing `onboarding.ts` (per architecture)
- No `components/provider/document-*.tsx` — use `components/onboarding/` (dedicated domain folder per architecture)
- No `db/schema/` changes — `provider_documents` table already exists from Epic 10 schema
- No migration needed — using existing tables
- No `lib/s3-upload.ts` — use existing `getPresignedUploadUrl()` and `getPresignedUrl()` from `lib/s3.ts`
- No server-side magic byte validation for presigned URL uploads — client uploads directly to S3, not through our server (unlike the logo upload flow which goes through Hono)

### Testing Requirements

**Test framework:** Vitest 4.0.18

**Provider endpoint tests (`tests/unit/onboarding-documents.test.ts`):**
1. `POST /upload-url` — valid request returns `{ uploadUrl, s3Key, expiresIn }`
2. `POST /upload-url` — invalid documentType returns 400
3. `POST /upload-url` — invalid mimeType returns 400
4. `POST /upload-url` — unauthenticated returns 401
5. `POST /documents` — valid request creates row, returns document, logs audit
6. `POST /documents` — oversized file (>10MB) returns 400
7. `POST /documents` — invalid mimeType returns 400
8. `POST /documents` — step not belonging to provider returns 404
9. `GET /documents` — returns own documents grouped by step
10. `GET /documents` — does NOT leak other providers' documents
11. `GET /documents/:id/url` — returns presigned URL for own document
12. `GET /documents/:id/url` — other provider's document returns 404
13. `POST /steps/:stepId/submit` — transitions to in_progress when docs uploaded
14. `POST /steps/:stepId/submit` — rejects when no documents uploaded

**Admin endpoint tests (`tests/unit/onboarding-admin-documents.test.ts`):**
15. `GET /:id/documents` — returns all docs with presigned URLs
16. `PATCH /:id/documents/:docId` — approve: sets status to approved, sets reviewedBy/At
17. `PATCH /:id/documents/:docId` — reject: requires reason, sets rejectionReason
18. `PATCH /:id/documents/:docId` — reject without reason returns 400
19. `PATCH /:id/documents/:docId` — already reviewed document returns 400
20. `PATCH /:id/documents/:docId` — document not found returns 404
21. `PATCH /:id/documents/:docId` — approve triggers WebSocket broadcast
22. `PATCH /:id/documents/:docId` — approve triggers notification
23. `PATCH /:id/documents/:docId` — approve last doc auto-completes step
24. Auto-complete — step completion triggers provider auto-transition check

### Previous Story Intelligence (10-1, 10-2, 10-3)

**Key learnings from story 10-1:**
- `initializeOnboardingPipeline()` creates 5 steps including `insurance` and `certifications` — these are the steps this story's document upload serves
- Schema: `providerDocuments` table already created with all needed columns (s3Key, status, reviewedBy, etc.)
- TOCTOU pattern: pre-check status + WHERE clause on update — apply to auto-complete logic
- All 24 audit action types registered — but `document.*` actions may need to be added if not yet present

**Key learnings from story 10-2:**
- `OnboardingDashboard` component already listens for `onboarding:document_reviewed` WebSocket event and auto-refreshes — the frontend will pick up changes automatically
- Rate limiting is per-route in `onboarding.ts` — new endpoints inherit the existing per-route pattern
- `broadcastToUser()` import path from WebSocket module established in 10-2

**Key learnings from story 10-3:**
- `isValidStepTransition()` from `server/api/lib/onboarding-state-machine.ts` is the single source of truth for step status changes — use it for transitioning steps on document approval
- Admin step review endpoint pattern (`PATCH /:id/steps/:stepId`) already handles auto-transition — the document review endpoint should mirror the same auto-complete + auto-transition pattern
- All 237 tests pass after 10-3 — maintain this baseline

**Files created/modified by 10-1/10-2/10-3 that this story extends:**
- `server/api/routes/onboarding.ts` (~523 lines) — add 5 new document endpoints
- `server/api/routes/admin-providers.ts` (~834 lines) — add 2 new document endpoints
- `lib/validators.ts` (~500+ lines) — append 3 new validators
- `lib/constants.ts` (~140+ lines) — append 5 new constants
- `lib/s3.ts` (~60 lines) — use existing `getPresignedUploadUrl()` and `getPresignedUrl()` (do NOT modify)
- `db/schema/provider-documents.ts` — already exists, do NOT modify
- `server/websocket/types.ts` — add 2 new event types
- `server/api/lib/audit-logger.ts` — add 4 new audit action types

### Git Intelligence Summary

| Commit | Relevance |
|---|---|
| `a19f0b3` Add provider registration links | Low — marketing links, no overlap |
| `b4cc7d4` Fix Epic 10 bugs and complete XSS security audit | High — confirms Epic 10 is stable, XSS audit patterns apply |
| `9f1610a` Implement Epic 10: Provider onboarding pipeline | Critical — this is the base that this story extends |

### Project Structure Notes

- This story is **full-stack** — new API endpoints + new React components + frontend page
- The `provider_documents` schema is already created and exported — no schema changes needed
- Existing `lib/s3.ts` provides all needed S3 functions (`getPresignedUploadUrl`, `getPresignedUrl`) — do NOT create a separate upload utility
- The document upload flow is different from the logo upload flow: logo upload goes through our server (FormData → Hono → S3), but document upload goes directly to S3 via presigned URL (client → S3 PUT). This is intentional per architecture — documents are larger and we don't want them flowing through our server
- The `onboarding:document_reviewed` WebSocket event is already handled by the `OnboardingDashboard` component from 10-2 — the frontend will auto-refresh on review events
- Client-side image compression is done before generating the presigned URL — the compressed blob is what gets uploaded to S3
- Admin document review is a separate endpoint from the existing admin step review — documents have their own lifecycle (pending_review → approved/rejected) independent of the step status

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md` — Provider Documents Decision 1.2 (line ~974)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Document Upload Flow (line ~1513)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Admin Document Review Flow (line ~1519)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Document Upload API Response Format (line ~1217)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Step Status Transitions (lines ~1271-1282)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Audit Actions: document.* (line ~1148)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — S3 Integration Pattern (line ~1568)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Mobile-First Document Capture (PRD Technical Architecture, line ~308)]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — FR13-FR21 (Document Upload & Review)]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — NFR-S1, NFR-S2, NFR-S3, NFR-S8, NFR-S9 (Security)]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — NFR-P2, NFR-P3, NFR-P4 (Performance)]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2: Document Upload & Compliance Review (FR13-FR21)]
- [Source: `_bmad-output/implementation-artifacts/10-3-onboarding-state-machine-and-access-control.md` — State machine patterns, auto-transition logic]
- [Source: `db/schema/provider-documents.ts` — Existing schema definition]
- [Source: `lib/s3.ts` — Existing S3 utilities: getPresignedUploadUrl, getPresignedUrl, validateFileContent, ALLOWED_IMAGE_TYPES]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

**New files (6):**
- `components/onboarding/document-uploader.tsx` — Mobile-first camera capture + compression + S3 upload
- `components/onboarding/document-preview.tsx` — Photo preview with retake/submit buttons
- `components/onboarding/document-card.tsx` — Individual document status card with re-upload
- `app/(provider)/provider/onboarding/documents/page.tsx` — Document upload page with Suspense
- `tests/unit/document-upload-routes.test.ts` — Provider document endpoint tests (22 tests)
- `tests/unit/admin-document-review.test.ts` — Admin document review endpoint tests (12 tests)

**Modified files (7):**
- `server/api/routes/onboarding.ts` — Added 5 endpoints: POST /upload-url, POST /documents, GET /documents, GET /documents/:id/url, POST /steps/:stepId/submit
- `server/api/routes/admin-providers.ts` — Added 2 endpoints: GET /:id/documents, PATCH /:id/documents/:documentId
- `lib/validators.ts` — Added documentUploadUrlSchema, documentCreateSchema, adminDocumentReviewSchema
- `lib/constants.ts` — Added PRESIGNED_UPLOAD_EXPIRY, PRESIGNED_DOWNLOAD_EXPIRY_ADMIN, PRESIGNED_DOWNLOAD_EXPIRY_PROVIDER, MAX_UPLOAD_SIZE, ALLOWED_DOCUMENT_IMAGE_TYPES, MIN_DOCUMENTS_PER_STEP
- `server/api/lib/audit-logger.ts` — Added document.uploaded, document.approved, document.rejected, document.resubmitted audit actions
- `server/websocket/types.ts` — Added onboarding:document_reviewed and onboarding:new_submission event types
- `lib/notifications/index.ts` — Added notifyDocumentReviewed function

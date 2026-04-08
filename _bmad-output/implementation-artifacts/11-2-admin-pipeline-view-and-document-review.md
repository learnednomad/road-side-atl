# Story 11.2: Admin Pipeline View and Document Review

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to view all providers in the onboarding pipeline grouped by current stage, filter and search them, view a complete onboarding checklist for any provider, review uploaded documents with zoom capability, and approve or reject documents with required reasons,
so that I can efficiently manage the provider onboarding pipeline, ensure document compliance, and move providers through to activation.

## Acceptance Criteria

1. **Given** an admin navigates to the admin providers page, **When** there are providers in onboarding statuses (applied, onboarding, pending_review), **Then** a pipeline view tab/section is displayed showing providers grouped by stage columns/tabs: Applied, Documents Pending, Background Check, Stripe Setup, Training, Ready for Review, Active, with each provider card showing: name, application date, steps completed count (e.g., "3/5"), and next action needed.

2. **Given** the admin is viewing the pipeline view, **When** the admin uses the filter controls, **Then** they can filter providers by onboarding stage, search by name or email, and sort by application date (ascending/descending). The pipeline loads in < 2 seconds with up to 50 in-progress providers (NFR-P7).

3. **Given** the admin clicks on a provider card in the pipeline, **When** the provider detail panel opens, **Then** a complete onboarding checklist is displayed showing all 5 steps (background_check, insurance, certifications, training, stripe_connect) with their current status badge (Not Started/gray, In Progress/blue, Pending Review/yellow, Approved/green, Rejected/red), completion timestamps, and reviewer info where applicable.

4. **Given** the admin views a provider's onboarding detail, **When** the provider has uploaded documents for insurance or certifications steps, **Then** the admin can see all documents for each step listed as individual cards showing: document name, upload date, file size, MIME type, and current review status (Pending Review/yellow, Approved/green, Rejected/red with reason visible).

5. **Given** the admin clicks on a document card, **When** the document review modal opens, **Then** the admin sees the document image loaded via a presigned download URL (10-minute expiry per NFR-S3), with zoom capability (pinch-to-zoom on mobile, scroll-zoom on desktop), document metadata (file name, size, type, upload date), and "Approve" / "Reject" action buttons.

6. **Given** the admin clicks "Approve" on a document, **When** the approval is processed, **Then** the `provider_documents` record is updated with `status: "approved"`, `reviewedBy`, `reviewedAt`, `logAudit("document.approved")` is recorded, an `onboarding:document_reviewed` WebSocket event is broadcast to the provider, and a fire-and-forget notification is sent via `notifyDocumentReviewed(providerId, docType, "approved").catch(err => { console.error("[Notifications] Failed:", err); })`.

7. **Given** the admin clicks "Reject" on a document, **When** the rejection form is displayed, **Then** a rejection reason text field is required (minimum 1 character), and on submission: the `provider_documents` record is updated with `status: "rejected"`, `rejectionReason`, `reviewedBy`, `reviewedAt`, `logAudit("document.rejected")` is recorded, an `onboarding:document_reviewed` WebSocket event is broadcast to the provider with the rejection reason, and a fire-and-forget notification is sent.

8. **Given** the admin approves the last pending document for a step, **When** all documents for that step are now approved, **Then** the `onboarding_steps` record for that step transitions to `complete` via `isValidStepTransition()`, `logAudit("onboarding.step_completed")` is recorded with `trigger: "all_documents_approved"`, and the all-steps-complete auto-transition check runs (if all 5 steps now complete, provider status transitions to `pending_review`).

9. **Given** a document has already been reviewed (status is `approved` or `rejected`), **When** the admin attempts to review it again, **Then** the server returns a 400 error: `"Cannot review document with status: {status}"`. Already-reviewed documents show their status but the review action buttons are disabled in the UI.

10. **Given** the admin is viewing the pipeline, **When** a provider completes an onboarding step or submits a document, **Then** the pipeline view updates in real-time via WebSocket subscription to `onboarding:new_submission` and `onboarding:step_updated` events, without requiring a page refresh.

11. **Given** the admin views the pipeline, **When** providers exist in `pending_review` status (all steps complete), **Then** they appear in the "Ready for Review" stage column with an "Activate" button that uses the existing `POST /:id/activate` endpoint, and a "Reject" button that uses the existing `POST /:id/reject` endpoint.

12. **Given** presigned download URLs are generated for admin document review, **When** the URL is created, **Then** it expires within 10 minutes (NFR-S3), and document URLs are scoped so only admins can access them (NFR-S9) — the endpoint requires `requireAdmin` middleware.

## Tasks / Subtasks

- [x] Task 1: Add admin document review API endpoints to `admin-providers.ts` (AC: 4, 5, 6, 7, 8, 9, 12)
  - [x] 1.1 Add `GET /:id/documents` — Already implemented in story 11-1
  - [x] 1.2 Add `PATCH /:id/documents/:documentId` — Already implemented in story 11-1
  - [x] 1.3 Add auto-complete check in document review endpoint — Already implemented in story 11-1; enhanced with `broadcastToAdmins` for `onboarding:ready_for_review`

- [x] Task 2: Add admin pipeline API endpoint to `admin-providers.ts` (AC: 1, 2)
  - [x] 2.1 Add `GET /pipeline` — returns providers grouped by stage with search, stage filter, sort support
  - [x] 2.2 Pipeline stage determination logic — providers grouped by first incomplete step in priority order

- [x] Task 3: Add Zod validators (AC: 6, 7, 9)
  - [x] 3.1 `adminDocumentReviewSchema` — Already existed in `lib/validators.ts` from story 11-1

- [x] Task 4: Add notification function (AC: 6, 7)
  - [x] 4.1 `notifyDocumentReviewed` — Already existed in `lib/notifications/index.ts` from story 11-1

- [x] Task 5: Add audit action types (AC: 6, 7, 8)
  - [x] 5.1 `document.uploaded`, `document.approved`, `document.rejected`, `document.resubmitted` — Already present in `audit-logger.ts` from story 11-1

- [x] Task 6: Create admin pipeline view UI components (AC: 1, 2, 3, 10, 11)
  - [x] 6.1 Created `components/admin/provider-pipeline.tsx` — pipeline view with stage tabs, search, filter, sort, WebSocket subscription for real-time updates
  - [x] 6.2 Created `components/admin/onboarding-detail-panel.tsx` — full onboarding checklist with step cards, document lists, activate/reject buttons

- [x] Task 7: Create document review modal component (AC: 4, 5, 6, 7, 9)
  - [x] 7.1 Created `components/admin/document-review-modal.tsx` — document display with zoom, approve/reject actions, disabled buttons for reviewed docs

- [x] Task 8: Integrate pipeline view into admin providers page (AC: 1, 3)
  - [x] 8.1 Created `app/(admin)/admin/providers/providers-page-tabs.tsx` — tab layout wrapping existing providers table + pipeline view
  - [x] 8.2 Modified `app/(admin)/admin/providers/[id]/page.tsx` — added `OnboardingSection` for providers in onboarding statuses

- [x] Task 9: Add WebSocket event types (AC: 10)
  - [x] 9.1 Added `onboarding:ready_for_review` event type to `server/websocket/types.ts`
  - [x] 9.2 Added `broadcastToAdmins({ type: "onboarding:ready_for_review" })` call in auto-complete cascade

- [x] Task 10: Write tests (AC: 1-12)
  - [x] 10.1 Unit tests for `GET /pipeline`: 7 tests — grouped stages, empty pipeline, stage filter, background_check/training/stripe_setup grouping, step completion count (in `admin-pipeline.test.ts`)
  - [x] 10.2 Unit tests for `GET /:id/documents`: returns docs with presigned URLs, 404 for non-existent provider (in `admin-document-review.test.ts`)
  - [x] 10.3 Unit tests for `PATCH /:id/documents/:documentId`: approve, reject, reject without reason 400, already reviewed 400, broadcasts WebSocket, logs audit (in `admin-document-review.test.ts`)
  - [x] 10.4 Unit tests for auto-complete: step transition + provider auto-transition (in `admin-document-review.test.ts`)
  - [x] 10.5 Unit tests for notification: fire-and-forget pattern tested (in `admin-document-review.test.ts`)

## Dev Notes

### Technical Requirements

**Admin Pipeline Endpoint — `GET /pipeline`:**
```typescript
// In server/api/routes/admin-providers.ts
app.get("/pipeline", async (c) => {
  const { search, stage, sort } = c.req.query();

  // Fetch providers in onboarding-related statuses
  let query = db.select()
    .from(providers)
    .leftJoin(users, eq(providers.userId, users.id))
    .where(
      inArray(providers.status, ["applied", "onboarding", "pending_review"])
    );

  if (search) {
    query = query.where(
      or(
        ilike(users.name, `%${search}%`),
        ilike(users.email, `%${search}%`),
      )
    );
  }

  const providerRows = await query.orderBy(
    sort === "date_asc" ? asc(providers.createdAt) : desc(providers.createdAt)
  );

  // For each provider, get their onboarding steps to determine stage
  const stages: Record<string, typeof providerRows> = {
    applied: [],
    documents_pending: [],
    background_check: [],
    stripe_setup: [],
    training: [],
    ready_for_review: [],
  };

  for (const row of providerRows) {
    const steps = await db.query.onboardingSteps.findMany({
      where: eq(onboardingSteps.providerId, row.providers.id),
    });

    const completedCount = steps.filter(s => s.status === "complete").length;
    const providerWithMeta = { ...row, completedSteps: completedCount, totalSteps: steps.length };

    if (row.providers.status === "applied") {
      stages.applied.push(providerWithMeta);
    } else if (row.providers.status === "pending_review") {
      stages.ready_for_review.push(providerWithMeta);
    } else {
      // Determine stage by first incomplete step
      const stepPriority = ["background_check", "insurance", "certifications", "training", "stripe_connect"];
      const firstIncomplete = stepPriority.find(type =>
        steps.find(s => s.stepType === type && s.status !== "complete")
      );

      if (firstIncomplete === "insurance" || firstIncomplete === "certifications") {
        stages.documents_pending.push(providerWithMeta);
      } else if (firstIncomplete === "background_check") {
        stages.background_check.push(providerWithMeta);
      } else if (firstIncomplete === "stripe_connect") {
        stages.stripe_setup.push(providerWithMeta);
      } else if (firstIncomplete === "training") {
        stages.training.push(providerWithMeta);
      } else {
        stages.ready_for_review.push(providerWithMeta);
      }
    }
  }

  if (stage && stages[stage]) {
    return c.json({ stages: { [stage]: stages[stage] }, total: stages[stage].length }, 200);
  }

  const total = Object.values(stages).reduce((sum, arr) => sum + arr.length, 0);
  return c.json({ stages, total }, 200);
});
```

**Admin Document Review Endpoint — `GET /:id/documents`:**
```typescript
// In server/api/routes/admin-providers.ts
app.get("/:id/documents", async (c) => {
  const { id } = c.req.param();

  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, id),
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  const docs = await db.query.providerDocuments.findMany({
    where: eq(providerDocuments.providerId, id),
    orderBy: [asc(providerDocuments.documentType), desc(providerDocuments.createdAt)],
  });

  // Generate presigned download URLs for each document
  const docsWithUrls = await Promise.all(
    docs.map(async (doc) => ({
      ...doc,
      downloadUrl: await getPresignedUrl(doc.s3Key, PRESIGNED_DOWNLOAD_EXPIRY_ADMIN),
    }))
  );

  // Group by document type
  const grouped = docsWithUrls.reduce((acc, doc) => {
    const type = doc.documentType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(doc);
    return acc;
  }, {} as Record<string, typeof docsWithUrls>);

  return c.json({ documents: grouped }, 200);
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
    updateData.rejectionReason = null;
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

  // Broadcast WebSocket event to provider
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

            // Broadcast ready-for-review to admins
            broadcastToAdmins({
              type: "onboarding:ready_for_review",
              data: { providerId: id, providerName: provider.userId },
            });

            await logAudit({
              action: "onboarding.step_completed",
              userId: user.id,
              resourceType: "provider",
              resourceId: id,
              metadata: { newStatus: "pending_review", trigger: "all_steps_complete" },
            });
          }
        }
      }
    }
  }

  return c.json(updated, 200);
});
```

### Architecture Compliance

| Rule | Compliance |
|---|---|
| All API routes via Hono, NOT app/api/ | All endpoints added to existing `admin-providers.ts` Hono module |
| Zod v4: `import { z } from "zod/v4"` | New `adminDocumentReviewSchema` uses correct import |
| `updatedAt: new Date()` in every `.update().set()` | Included in every update operation |
| Destructure `.returning()` | `const [result] = await db.update(...).returning()` everywhere |
| Audit logging for ALL state changes | `logAudit()` on every document review and step transition |
| Named exports | All component and function exports are named |
| `@/` path alias for all imports | Consistent throughout |
| Fire-and-forget notifications | `.catch((err) => { console.error("[Notifications] Failed:", err); })` pattern |
| State machine transitions | Step transitions via `isValidStepTransition()` from `onboarding-state-machine.ts` |
| Admin pipeline response format | `{ stages: { [stage]: Provider[] }, total: number }` per architecture |
| Document review response format | `c.json(updatedDocument, 200)` per architecture |
| Presigned URL expiry (NFR-S3) | Admin download: 10 minutes |
| Document access scoping (NFR-S9) | Admin endpoint requires `requireAdmin` middleware |
| Pipeline load time (NFR-P7) | < 2 seconds with 50 providers — single query + batch step lookup |
| Admin components in `components/admin/` | `provider-pipeline.tsx`, `document-review-modal.tsx`, `onboarding-detail-panel.tsx` per architecture |
| Extend admin providers page, NOT new page | Tab-based layout on existing `/admin/providers` page per architecture Decision 4.2 |
| WebSocket real-time updates | Admin subscribes to `onboarding:new_submission`, `onboarding:step_updated`, `onboarding:ready_for_review` |

### Library & Framework Requirements

| Library | Version | Usage in This Story |
|---|---|---|
| Hono | ^4.11.7 | 3 new admin endpoints (pipeline, get docs, review doc) |
| Drizzle ORM | ^0.45.1 | Query providers + steps + documents, update documents + steps |
| Zod | ^4.3.6 | `import { z } from "zod/v4"` — 1 new validator (`adminDocumentReviewSchema`) |
| @aws-sdk/s3-request-presigner | existing | `getSignedUrl` for presigned download URLs |
| shadcn/ui | existing | Dialog, Tabs, Badge, Button, Input, Card components |
| ws | ^8.19.0 | `broadcastToUser()` and `broadcastToAdmins()` for WebSocket events |
| Vitest | ^4.0.18 | Unit tests for all endpoints |

**No new npm dependencies required.** All libraries already installed.

### File Structure Requirements

**New files (3):**
- `components/admin/provider-pipeline.tsx` — Admin pipeline view with stage grouping, search, filter, real-time updates
- `components/admin/document-review-modal.tsx` — Document image display with zoom + approve/reject actions
- `components/admin/onboarding-detail-panel.tsx` — Full onboarding checklist for a single provider with step cards + document lists

**Modified files (6):**
- `server/api/routes/admin-providers.ts` — Add 3 new endpoints: `GET /pipeline`, `GET /:id/documents`, `PATCH /:id/documents/:documentId`
- `lib/validators.ts` — Add 1 new schema: `adminDocumentReviewSchema`
- `lib/notifications/index.ts` — Add `notifyDocumentReviewed()` notification function
- `app/(admin)/admin/providers/page.tsx` — Add tab layout with "All Providers" and "Onboarding Pipeline" tabs
- `app/(admin)/admin/providers/[id]/page.tsx` — Add onboarding detail section for providers in onboarding statuses
- `server/api/lib/audit-logger.ts` — Verify `document.approved`, `document.rejected` audit action types exist (may already be present from 11-1)

**Conditionally modified files (2):**
- `server/websocket/types.ts` — Add `onboarding:ready_for_review` and `onboarding:new_submission` event types if not already present
- `lib/constants.ts` — Add `PRESIGNED_DOWNLOAD_EXPIRY_ADMIN = 600` if not already present from story 11-1

**New test files (2):**
- `tests/unit/admin-pipeline.test.ts` — Pipeline endpoint + document review endpoint tests
- `tests/unit/admin-document-review.test.ts` — Document review, auto-complete, and notification tests

**What NOT to create:**
- No `server/api/routes/admin-pipeline.ts` — pipeline endpoints go in existing `admin-providers.ts`
- No `app/(admin)/admin/providers/pipeline/page.tsx` — pipeline is a tab/section on existing providers page, not a separate page (per architecture Decision 4.2)
- No `components/onboarding/admin-*.tsx` — admin components go in `components/admin/` (per architecture boundaries)
- No `db/schema/` changes — all tables already exist from Epic 10
- No migration needed — using existing tables
- No new S3 utilities — use existing `getPresignedUrl()` from `lib/s3.ts`

### Testing Requirements

**Test framework:** Vitest 4.0.18

**Pipeline endpoint tests (`tests/unit/admin-pipeline.test.ts`):**
1. `GET /pipeline` — returns providers grouped by correct stages
2. `GET /pipeline` — providers in `applied` status appear in "applied" stage
3. `GET /pipeline` — providers in `pending_review` appear in "ready_for_review" stage
4. `GET /pipeline` — `onboarding` providers grouped by first incomplete step
5. `GET /pipeline?search=john` — filters by name
6. `GET /pipeline?stage=documents_pending` — returns only that stage
7. `GET /pipeline` — empty pipeline returns empty stages object with `total: 0`
8. `GET /pipeline` — unauthenticated returns 401, non-admin returns 403

**Document review tests (`tests/unit/admin-document-review.test.ts`):**
9. `GET /:id/documents` — returns all docs with presigned URLs grouped by type
10. `GET /:id/documents` — non-existent provider returns 404
11. `PATCH /:id/documents/:docId` — approve: sets status to approved, sets reviewedBy/At, clears rejectionReason
12. `PATCH /:id/documents/:docId` — reject: requires reason, sets rejectionReason
13. `PATCH /:id/documents/:docId` — reject without reason returns 400
14. `PATCH /:id/documents/:docId` — already approved/rejected document returns 400
15. `PATCH /:id/documents/:docId` — non-existent document returns 404
16. `PATCH /:id/documents/:docId` — approve triggers WebSocket broadcast `onboarding:document_reviewed`
17. `PATCH /:id/documents/:docId` — approve triggers `logAudit("document.approved")`
18. `PATCH /:id/documents/:docId` — reject triggers `logAudit("document.rejected")`
19. Auto-complete: approving last document transitions step to `complete`
20. Auto-complete: step completion when all steps done transitions provider to `pending_review`
21. `notifyDocumentReviewed` — sends email on approve
22. `notifyDocumentReviewed` — sends email with reason on reject

### Previous Story Intelligence (11-1, 10-1, 10-2, 10-3)

**Key learnings from story 11-1 (sibling — provider-side document upload):**
- Story 11-1 creates the provider-side document upload endpoints: `POST /upload-url`, `POST /documents`, `GET /documents`, `GET /documents/:documentId/url`, `POST /steps/:stepId/submit`
- The `provider_documents` rows will already exist when admin reviews them — 11-2 reads and updates what 11-1 creates
- S3 key pattern: `onboarding/{providerId}/{documentType}/{timestamp}.{ext}` — use this when generating presigned download URLs
- Document statuses: `pending_review` (uploaded, awaiting admin), `approved`, `rejected`
- Step transition on document submission: `pending`/`draft` → `in_progress` (11-1 handles this via submit endpoint)
- Admin auto-complete pattern: when all docs approved → step → `complete` (described in 11-1, must be implemented in 11-2's admin endpoint)
- WebSocket events `onboarding:document_reviewed` and `onboarding:new_submission` are defined in 11-1

**Key learnings from story 10-3 (state machine):**
- `isValidStepTransition()` from `server/api/lib/onboarding-state-machine.ts` is the single source of truth for step status changes
- Step review endpoint pattern (`PATCH /:id/steps/:stepId`) at line 802 of `admin-providers.ts` — the document review endpoint should mirror the same auto-complete + auto-transition pattern
- TOCTOU pattern: pre-check status + WHERE clause on update — apply to auto-complete logic

**Key learnings from story 10-2 (dashboard):**
- `OnboardingDashboard` component already listens for `onboarding:document_reviewed` WebSocket event and auto-refreshes
- `broadcastToUser()` import path established in admin-providers.ts
- Admin-side currently has NO WebSocket subscription — story 11-2 must add admin WebSocket listener in pipeline component

**Files created/modified by previous stories that this story extends:**
- `server/api/routes/admin-providers.ts` (~918 lines) — add 3 new endpoints at end
- `lib/validators.ts` (~500+ lines) — append 1 new validator
- `lib/notifications/index.ts` (~350+ lines) — add `notifyDocumentReviewed()` function
- `server/websocket/types.ts` — verify event types, add `onboarding:ready_for_review` if missing
- `app/(admin)/admin/providers/page.tsx` (~40 lines) — refactor to tab layout
- `app/(admin)/admin/providers/[id]/page.tsx` (~225 lines) — add onboarding section

### Git Intelligence Summary

| Commit | Relevance |
|---|---|
| `a19f0b3` Add provider registration links | Low — marketing links |
| `b4cc7d4` Fix Epic 10 bugs and complete XSS security audit | Medium — confirms Epic 10 is stable, XSS patterns apply |
| `9f1610a` Implement Epic 10: Provider onboarding pipeline | Critical — this is the base that this story extends |

**Key patterns from recent commits:**
- All admin routes follow `requireAdmin` middleware pattern
- WebSocket broadcasts follow `broadcastToUser()` pattern
- Audit logging on every state change
- TOCTOU protection: WHERE clause matching expected current status

### Project Structure Notes

- This story is **full-stack** — new API endpoints + 3 new React components + modifications to 2 admin pages
- The admin pipeline view extends the existing providers page as a tab (Decision 4.2) — do NOT create a new route
- The `provider_documents` and `onboarding_steps` schemas already exist — no schema changes needed
- Existing `getPresignedUrl()` from `lib/s3.ts` generates download URLs — use it for admin document viewing
- The document review modal should support zoom for careful document inspection — CSS `transform: scale()` with mouse wheel / pinch events
- Admin WebSocket subscription is NEW — the admin pipeline component must subscribe to real-time events for pipeline auto-refresh
- The `broadcastToAdmins()` function may need to be created or may already exist — check `server/websocket/` for existing admin broadcast patterns. If not available, broadcast to all connected admin users
- The `notifyDocumentReviewed()` function does NOT exist yet — must be created following the pattern of other notification functions like `notifyStatusChange()`
- Pipeline stage determination requires joining providers with their onboarding_steps — consider query efficiency for NFR-P7 (< 2 seconds with 50 providers)

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md` — Decision 4.2: Admin Pipeline View (line ~1080)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — New API Route Modules Decision 3.3 (line ~1052)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Admin Pipeline Response Format (line ~1218)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Document Review Response Format (line ~1219)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Admin Document Review Flow (line ~1519)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Step Status Transitions (lines ~1271-1282)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Component Boundaries (line ~1487)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Audit Actions: document.* (line ~1148)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — WebSocket Events (lines ~1159-1166)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Notification Triggers (lines ~1244-1255)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Architectural Boundaries (lines ~1470-1490)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — File Organization (lines ~1375-1467)]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — FR19-FR21 (Admin Document Review)]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — FR40-FR45 (Admin Pipeline Management)]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — NFR-P7 (Admin pipeline < 2 seconds)]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — NFR-S3 (Presigned download URL 10-min expiry)]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — NFR-S9 (Document access scoping)]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2: Document Upload & Compliance Review (FR13-FR21)]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 6: Admin Onboarding Pipeline Management (FR40-FR45)]
- [Source: `_bmad-output/implementation-artifacts/11-1-mobile-document-capture-and-upload-system.md` — Full previous story context]
- [Source: `server/api/routes/admin-providers.ts` — Existing endpoints and patterns]
- [Source: `server/api/lib/onboarding-state-machine.ts` — State transition validation functions]
- [Source: `db/schema/provider-documents.ts` — Document table schema]
- [Source: `db/schema/onboarding-steps.ts` — Step table schema]
- [Source: `lib/s3.ts` — Existing getPresignedUrl() utility]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed mock hoisting errors in `admin-pipeline.test.ts` — moved mock chain variables inside `vi.mock` factory
- Fixed `__mockSelectOrderBy` access error — used `(db as any)._pipelineResults` pattern instead of named export
- Updated `onboarding-admin-providers.test.ts` and `admin-document-review.test.ts` mocks for new imports (`broadcastToAdmins`, `or`, `asc`, `ilike`)
- Enhanced `GET /:id` endpoint to include `onboardingSteps` data for admin-side onboarding views (avoiding dependency on provider-only `/api/onboarding/steps`)

### Completion Notes List

- Tasks 1, 3, 4, 5 were already implemented from story 11-1 — avoided duplicate work
- Placed `/pipeline` route BEFORE `/:id` to avoid Hono route conflict
- All 279 tests pass across 18 test files with zero regressions
- TypeScript compilation passes cleanly

### Code Review Fixes Applied

- **H1 (Performance):** Eliminated N+1 query in pipeline endpoint — batch-fetches all onboarding steps with single `inArray` query instead of per-provider queries
- **H2 (Security):** Escaped `%` and `_` SQL LIKE wildcards in search parameter to prevent pattern matching abuse
- **M2 (Type Safety):** Added `onboardingStepId` to DocumentInfo interface in document-review-modal.tsx
- **M3 (Error Handling):** Added toast error notification when pipeline fetch fails
- **M4 (Data Freshness):** Added `fetchData()` call on error in OnboardingDetailPanel activate/reject handlers
- **L1 (Correctness):** Changed `replace("_", " ")` to `replaceAll("_", " ")` in document-review-modal and onboarding-section
- **M1 (Documentation):** Added missing `page.tsx` to File List

### File List

**New files (5):**
- `components/admin/provider-pipeline.tsx` — Admin pipeline view with stage tabs, search, filter, sort, WebSocket real-time updates
- `components/admin/document-review-modal.tsx` — Document review modal with zoom, approve/reject actions
- `components/admin/onboarding-detail-panel.tsx` — Full onboarding checklist with step cards, document lists, activate/reject
- `app/(admin)/admin/providers/providers-page-tabs.tsx` — Tab layout wrapper for providers page
- `app/(admin)/admin/providers/[id]/onboarding-section.tsx` — Onboarding progress section for provider detail page

**Modified files (4):**
- `server/api/routes/admin-providers.ts` — Added `GET /pipeline` endpoint (batch-fetch, LIKE escaping), enhanced `GET /:id` with onboardingSteps, added `broadcastToAdmins` import and call
- `server/websocket/types.ts` — Added `onboarding:ready_for_review` event type
- `app/(admin)/admin/providers/[id]/page.tsx` — Added OnboardingSection for providers in onboarding statuses
- `app/(admin)/admin/providers/page.tsx` — Wrapped content with `ProvidersPageTabs` for tab layout

**New test files (1):**
- `tests/unit/admin-pipeline.test.ts` — 7 tests for pipeline endpoint

**Modified test files (2):**
- `tests/unit/admin-document-review.test.ts` — Updated mocks for new imports (12 tests)
- `tests/unit/onboarding-admin-providers.test.ts` — Updated mocks for new imports (17 tests)

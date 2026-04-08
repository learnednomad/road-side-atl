# Story 12.2: Admin Adjudication, Polling Reconciliation, and Dispatch Gating

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to adjudicate "consider" background check results (approve or initiate adverse action), have the system automatically reconcile stale checks via polling, and enforce dispatch gating so providers cannot receive jobs until their background check is cleared or admin-approved,
so that the platform maintains safety compliance, FCRA requirements are met, and no provider slips through without proper vetting.

## Acceptance Criteria

1. **Given** a provider's background check step is in `pending_review` status (Checkr returned `consider`), **When** an admin views the provider's onboarding detail, **Then** the admin sees the background check step with status `pending_review`, a "Requires Adjudication" badge, the Checkr report ID, a direct link to the Checkr Dashboard report (`https://dashboard.checkr.com/reports/{reportId}`), and action buttons for "Approve Provider" and "Initiate Adverse Action".

2. **Given** an admin clicks "Approve Provider" on a `pending_review` background check step, **When** the admin confirms the adjudication decision with a required reason, **Then** the system transitions the step status from `pending_review` to `complete`, sets `completedAt`, stores `{ adjudicationDecision: "approved", adjudicationReason, adjudicatedBy, adjudicatedAt }` in the step's `metadata` JSONB, logs `checkr.adjudication_approved` via `logAudit()` with the admin's userId and reason, broadcasts `onboarding:step_updated` to the provider via WebSocket, sends a fire-and-forget notification to the provider that their background check has been approved, and runs the all-steps-complete auto-transition check.

3. **Given** an admin clicks "Initiate Adverse Action" on a `pending_review` background check step, **When** the admin confirms with a required reason, **Then** the system calls `checkr.createAdverseAction(reportId)` (already implemented in `server/api/lib/checkr.ts`), transitions the step status from `pending_review` to `rejected`, sets `rejectionReason` to the admin's reason, stores `{ adjudicationDecision: "adverse_action", adjudicationReason, adjudicatedBy, adjudicatedAt, checkrAdverseActionId }` in metadata, logs `checkr.adverse_action_initiated` via `logAudit()`, broadcasts `onboarding:step_updated` to the provider, and sends a fire-and-forget notification that the background check did not pass.

4. **Given** a provider's `background_check` step has been `in_progress` for more than 24 hours, **When** the existing `reconcileCheckrStatuses()` function runs (via `POST /api/admin/reconcile/checkr`), **Then** it polls `checkr.getReport(reportId)` for each stale step, updates the step status using `CHECKR_STATUS_MAP` if Checkr reports a terminal state, handles the `adjudication` field override (adjudication takes precedence over raw status), logs each reconciliation action, broadcasts WebSocket updates, and returns a summary of `{ checked, updated, errors }`.

5. **Given** a provider has `status !== 'active'` (onboarding incomplete), **When** the provider attempts to access any dispatch-gated route (`/api/provider/jobs/*`, `/api/provider/earnings/*`, `/api/provider/stats/*`, `/api/provider/invoices/*`), **Then** the existing `requireOnboardingComplete` middleware returns `403` with `{ error: "Onboarding incomplete", redirect: "/provider/onboarding" }`, unless the provider has a valid `migrationBypassExpiresAt > NOW()` (in which case access is allowed with an audit log entry).

6. **Given** a provider's background check step is `complete` (cleared or admin-approved) AND all other onboarding steps are also `complete`, **When** the all-steps-complete check runs (existing pattern from story 11-2), **Then** the provider's status transitions to `pending_review` (ready for admin final activation), and `broadcastToAdmins({ type: "onboarding:provider_ready" })` is sent.

7. **Given** an admin views the pipeline at `GET /api/admin/providers/pipeline`, **When** there are providers with `pending_review` background check steps, **Then** the pipeline response includes these providers in a "Background Check Review" stage with their Checkr report ID, step status, and time since the check completed, enabling the admin to prioritize adjudication.

8. **Given** the Checkr API is unavailable when an admin initiates adverse action, **When** the `createAdverseAction()` call fails after retries, **Then** the system returns `503` with `{ error: "Checkr service temporarily unavailable" }`, the step status remains `pending_review` (no transition), the error is logged with full context, and the admin can retry later.

9. **Given** `reconcileCheckrStatuses()` runs and finds a step where Checkr reports `adjudication: "post_adverse_action"`, **When** the reconciliation processes this step, **Then** it maps `post_adverse_action` to step status `rejected` (via `CHECKR_STATUS_MAP`), sets a `rejectionReason`, logs the reconciliation action, and notifies the provider.

10. **Given** an admin triggers reconciliation via `POST /api/admin/reconcile/checkr`, **When** the reconciliation completes, **Then** the response includes `{ checked: number, updated: number, errors: number, details: Array<{ providerId, previousStatus, newStatus, checkrStatus }> }` so the admin can see exactly what changed.

## Tasks / Subtasks

- [x] Task 1: Add admin adjudication endpoints (AC: 1, 2, 3, 8)
  - [x] 1.1 Add `POST /:id/adjudicate` endpoint in `server/api/routes/admin-providers.ts` — accepts `{ decision: "approve" | "adverse_action", reason: string }`, validates step is `pending_review` with `stepType = "background_check"`
  - [x] 1.2 For `decision: "approve"`: transition step `pending_review` → `complete` via `isValidStepTransition()`, set `completedAt`, store adjudication metadata in step's `metadata` JSONB, log `checkr.adjudication_approved`, broadcast to provider, fire-and-forget notification, run all-steps-complete check
  - [x] 1.3 For `decision: "adverse_action"`: call `checkr.createAdverseAction(reportId)`, transition step `pending_review` → `rejected`, set `rejectionReason`, store adjudication metadata including `checkrAdverseActionId`, log `checkr.adverse_action_initiated`, broadcast to provider, fire-and-forget notification
  - [x] 1.4 Handle Checkr API failure for adverse action: return 503, do NOT transition step status, log error
  - [x] 1.5 Add Zod validator for adjudication request body: `{ decision: z.enum(["approve", "adverse_action"]), reason: z.string().min(10).max(500) }`

- [x] Task 2: Enhance pipeline endpoint for adjudication visibility (AC: 1, 7)
  - [x] 2.1 Modify `GET /:id` in `admin-providers.ts` to include background check adjudication state in the provider detail response: step status, Checkr report ID, Checkr dashboard link, time since completion, adjudication metadata
  - [x] 2.2 Modify `GET /pipeline` to include a "Background Check Review" stage grouping — providers whose `background_check` step is `pending_review`
  - [x] 2.3 Add `checkrDashboardUrl` computed field: `https://dashboard.checkr.com/reports/${checkrReportId}`

- [x] Task 3: Enhance reconciliation with detailed reporting (AC: 4, 9, 10)
  - [x] 3.1 Modify `reconcileCheckrStatuses()` in `server/api/lib/reconciliation.ts` to return detailed results: `{ checked, updated, errors, details: Array<{ providerId, stepId, previousStatus, newStatus, checkrStatus, adjudication }> }`
  - [x] 3.2 Ensure adjudication field override is handled correctly: `effectiveStatus = report.adjudication || report.status` (verify this already works — codebase analysis shows it does)
  - [x] 3.3 Add notification dispatch in reconciliation: when a step status changes via reconciliation, send fire-and-forget notification to the provider
  - [x] 3.4 Modify `POST /reconcile/checkr` in `admin-providers.ts` to return the detailed results from reconciliation

- [x] Task 4: Verify dispatch gating middleware (AC: 5)
  - [x] 4.1 Verify `requireOnboardingComplete` middleware in `server/api/middleware/onboarding.ts` correctly blocks providers who are not `active` — read the existing implementation and confirm it works for all dispatch-gated routes
  - [x] 4.2 Verify middleware is applied to `/api/provider/jobs/*`, `/api/provider/earnings/*`, `/api/provider/stats/*`, `/api/provider/invoices/*`
  - [x] 4.3 Verify migration bypass logic works correctly (`migrationBypassExpiresAt > NOW()`)
  - [x] 4.4 If middleware is NOT applied to any required routes, add it. If already applied, document confirmation in completion notes.

- [x] Task 5: Add audit action types and constants (AC: 2, 3)
  - [x] 5.1 Add `checkr.adverse_action_initiated` to `AuditAction` type in `server/api/lib/audit-logger.ts` (verify `checkr.adjudication_approved` already exists)
  - [x] 5.2 Add `CHECKR_DASHBOARD_BASE_URL = "https://dashboard.checkr.com/reports"` to `lib/constants.ts`
  - [x] 5.3 Add adjudication Zod validator to `lib/validators.ts`: `adjudicationRequestSchema`

- [x] Task 6: Add notification for adjudication results (AC: 2, 3)
  - [x] 6.1 Add `notifyAdjudicationResult(providerId, decision, reason)` to `lib/notifications/index.ts`
  - [x] 6.2 Follow existing fire-and-forget pattern: `.catch((err) => { console.error("[Notifications] Failed:", err); })`
  - [x] 6.3 Email content: "approved" (positive — "Your background check review is complete, you're cleared to proceed"), "adverse_action" (rejection — "Background check review complete — action required, contact support")

- [x] Task 7: Write tests (AC: 1-10)
  - [x] 7.1 Unit tests for adjudication endpoint: approve decision → step complete, adverse action decision → step rejected + Checkr API called, missing reason → 400, step not pending_review → 409, Checkr API failure → 503
  - [x] 7.2 Unit tests for enhanced reconciliation: returns detailed results, handles adjudication override, sends notifications on status change
  - [x] 7.3 Unit tests for pipeline enhancement: providers with pending_review background check appear in "Background Check Review" stage
  - [x] 7.4 Unit tests for dispatch gating: verify middleware blocks non-active providers, allows active providers, allows migration bypass
  - [x] 7.5 Unit tests for notification: notifyAdjudicationResult for each decision type

## Dev Notes

### Technical Requirements

**Admin Adjudication Endpoint — add to `server/api/routes/admin-providers.ts`:**
```typescript
// POST /:id/adjudicate — Admin adjudication of "consider" background check
// Requires: requireAdmin middleware (already on all admin-providers routes)

app.post("/:id/adjudicate", async (c) => {
  const providerId = c.req.param("id");
  const body = adjudicationRequestSchema.parse(await c.req.json());
  // body: { decision: "approve" | "adverse_action", reason: string }

  // 1. Find background_check step for this provider
  const step = await db.select()
    .from(onboardingSteps)
    .where(
      and(
        eq(onboardingSteps.providerId, providerId),
        eq(onboardingSteps.stepType, "background_check"),
        eq(onboardingSteps.status, "pending_review")
      )
    )
    .limit(1);

  if (!step.length) {
    return c.json({ error: "No pending adjudication found" }, 409);
  }

  const adminUserId = c.get("userId"); // from requireAdmin middleware
  const metadata = step[0].metadata as Record<string, unknown>;
  const reportId = metadata?.checkrReportId as string;

  if (body.decision === "approve") {
    // Validate transition
    if (!isValidStepTransition(step[0].status, "complete")) {
      return c.json({ error: "Invalid status transition" }, 409);
    }

    await db.update(onboardingSteps).set({
      status: "complete",
      completedAt: new Date(),
      metadata: {
        ...metadata,
        adjudicationDecision: "approved",
        adjudicationReason: body.reason,
        adjudicatedBy: adminUserId,
        adjudicatedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    }).where(
      and(
        eq(onboardingSteps.id, step[0].id),
        eq(onboardingSteps.status, "pending_review") // TOCTOU guard
      )
    );

    logAudit({
      action: "checkr.adjudication_approved",
      userId: adminUserId,
      resourceType: "onboarding_step",
      resourceId: step[0].id,
      details: { providerId, reason: body.reason, reportId },
    });

    // Broadcast + notification + all-steps-complete check
    // (same patterns as webhooks.ts and story 11-2)

  } else if (body.decision === "adverse_action") {
    // Call Checkr API first — if it fails, don't transition
    try {
      const adverseAction = await createAdverseAction(reportId);
      // ... transition step to rejected, store metadata, audit, notify
    } catch (err) {
      // Checkr API failure — don't transition
      return c.json({ error: "Checkr service temporarily unavailable" }, 503);
    }
  }
});
```

**Reconciliation Enhancement — modify `server/api/lib/reconciliation.ts`:**
```typescript
// Enhanced return type with details
interface ReconciliationResult {
  checked: number;
  updated: number;
  errors: number;
  details: Array<{
    providerId: string;
    stepId: string;
    previousStatus: string;
    newStatus: string;
    checkrStatus: string;
    adjudication: string | null;
  }>;
}

// reconcileCheckrStatuses() already handles adjudication override:
// effectiveStatus = report.adjudication || report.status
// Enhancement: add details array tracking + notification dispatch
```

**Checkr Dashboard Link Construction:**
```typescript
// Constant in lib/constants.ts
export const CHECKR_DASHBOARD_BASE_URL = "https://dashboard.checkr.com/reports";

// Usage in admin detail response
const checkrDashboardUrl = `${CHECKR_DASHBOARD_BASE_URL}/${checkrReportId}`;
```

**Pipeline Stage Grouping for Background Check Review:**
```typescript
// In GET /pipeline, existing query groups providers by onboarding stage
// Add "background_check_review" stage for providers whose background_check step is pending_review
// Query: JOIN onboarding_steps WHERE stepType = 'background_check' AND status = 'pending_review'
```

### Architecture Compliance

| Rule | Compliance |
|---|---|
| All API routes via Hono, NOT app/api/ | Adjudication endpoint in existing `admin-providers.ts` |
| No new route files | Extends existing `admin-providers.ts` — no new route file |
| Zod v4: `import { z } from "zod/v4"` | Adjudication validator uses correct import |
| `updatedAt: new Date()` in every `.update().set()` | Included in all step status updates |
| Audit logging for ALL state changes | `checkr.adjudication_approved`, `checkr.adverse_action_initiated` logged |
| Fire-and-forget notifications | `.catch((err) => { console.error("[Notifications] Failed:", err); })` |
| State machine transitions | All step status changes go through `isValidStepTransition()` |
| TOCTOU protection | WHERE clause guards on expected current status |
| Direct REST, no Checkr SDK | Uses existing `createAdverseAction()` from `server/api/lib/checkr.ts` |
| Minimal PII storage (NFR-S5) | Only adjudication decision + reason stored — never full report |
| Webhook returns 200 within 5s | N/A — this story is admin-initiated, not webhook |
| `requireAdmin` middleware | All admin-providers routes already protected |
| FCRA compliance | Adverse action initiated via Checkr API (handles pre-adverse/final notices) |

### Library & Framework Requirements

| Library | Version | Usage in This Story |
|---|---|---|
| Hono | ^4.11.7 | Admin adjudication endpoint handler |
| Drizzle ORM | ^0.45.1 | JSONB metadata queries, step status updates, pipeline grouping |
| Zod v4 | ^4.x | Adjudication request validation |
| Vitest | ^4.0.18 | Unit tests for all new functionality |

**No new npm dependencies required.** Uses existing `createAdverseAction()` from `checkr.ts`.

### File Structure Requirements

**New files (1):**
- `tests/unit/admin-adjudication.test.ts` — Unit tests for adjudication endpoint, reconciliation enhancement, pipeline stage, dispatch gating verification

**Modified files (6):**
- `server/api/routes/admin-providers.ts` — Add `POST /:id/adjudicate` endpoint, enhance `GET /:id` detail response with adjudication state, enhance `GET /pipeline` with background check review stage, enhance `POST /reconcile/checkr` response
- `server/api/lib/reconciliation.ts` — Add detailed results tracking, add notification dispatch on status change
- `server/api/lib/audit-logger.ts` — Add `checkr.adverse_action_initiated` audit action type
- `lib/constants.ts` — Add `CHECKR_DASHBOARD_BASE_URL`
- `lib/validators.ts` — Add `adjudicationRequestSchema`
- `lib/notifications/index.ts` — Add `notifyAdjudicationResult(providerId, decision, reason)`

**Files to verify (not modify unless needed):**
- `server/api/middleware/onboarding.ts` — Verify `requireOnboardingComplete` is correctly applied to dispatch-gated routes
- `server/api/lib/checkr.ts` — Verify `createAdverseAction()` works correctly (already implemented in story 12-1)
- `server/api/routes/onboarding.ts` — No changes needed (provider-facing endpoints already exist)

**What NOT to create:**
- No new route files — everything goes in existing `admin-providers.ts`
- No schema changes — `onboarding_steps.metadata` JSONB already supports arbitrary data (adjudication fields stored as JSONB properties)
- No new UI components — admin pipeline view from story 11-2 already renders step status badges; `pending_review` status for background_check will display automatically; adjudication actions are API-only in this story
- No new middleware file — `requireOnboardingComplete` already exists; just verify it's applied correctly
- No cron job — reconciliation is admin-triggered via existing endpoint; future cron is out of scope

### Testing Requirements

**Test framework:** Vitest 4.0.18

**Admin adjudication tests:**
1. `POST /:id/adjudicate` with `decision: "approve"` — step transitions to `complete`, metadata updated, audit logged
2. `POST /:id/adjudicate` with `decision: "adverse_action"` — Checkr API called, step transitions to `rejected`, metadata updated, audit logged
3. `POST /:id/adjudicate` with missing reason — returns 400
4. `POST /:id/adjudicate` with reason too short (<10 chars) — returns 400
5. `POST /:id/adjudicate` when step is NOT `pending_review` — returns 409
6. `POST /:id/adjudicate` when no background_check step exists — returns 409
7. `POST /:id/adjudicate` adverse action with Checkr API failure — returns 503, step remains `pending_review`
8. Adjudication triggers all-steps-complete check when approving
9. WebSocket broadcast to provider on adjudication decision
10. Fire-and-forget notification sent for each decision type

**Enhanced reconciliation tests:**
11. `reconcileCheckrStatuses()` returns detailed results with providerId, previousStatus, newStatus
12. Reconciliation handles `adjudication: "post_adverse_action"` → maps to `rejected`
13. Reconciliation sends notification to provider on status change
14. `POST /reconcile/checkr` returns detailed results in response body

**Pipeline enhancement tests:**
15. `GET /pipeline` includes "Background Check Review" stage with providers in `pending_review`
16. `GET /:id` includes background check adjudication state, Checkr dashboard link

**Dispatch gating tests:**
17. Verify `requireOnboardingComplete` blocks provider with status `onboarding`
18. Verify `requireOnboardingComplete` allows provider with status `active`
19. Verify migration bypass allows access when `migrationBypassExpiresAt > NOW()`
20. Verify migration bypass blocks access when `migrationBypassExpiresAt < NOW()`

### Previous Story Intelligence (12-1)

**Key learnings from story 12-1 (Checkr API + Webhook Processing):**
- `createAdverseAction(reportId)` is already implemented and exported from `server/api/lib/checkr.ts` (line ~154) but NOT wired to any admin endpoint — this story connects it
- `CHECKR_STATUS_MAP` is in `lib/constants.ts` and handles: clear→complete, consider→pending_review, suspended→rejected, adverse_action→rejected, post_adverse_action→rejected
- Reconciliation already uses `effectiveStatus = report.adjudication || report.status` for adjudication override
- Event deduplication via `processedEvents` Set already handles duplicate webhooks
- `checkr.adjudication_approved` audit action type already exists in `audit-logger.ts` but is never logged — this story uses it
- Webhook handler correctly maps `consider` → `pending_review` (which is the trigger for admin adjudication)
- Code review fix from 12-1: webhook now looks up by `checkrCandidateId` (not `checkrReportId`), and report ID is backfilled in metadata when webhook fires

**Key learnings from story 11-2 (Admin Pipeline + Document Review):**
- All-steps-complete auto-transition pattern: when step → `complete`, check ALL steps → transition provider to `pending_review`
- `broadcastToAdmins()` pattern for real-time admin updates
- Document review pattern: `PATCH /:id/documents/:documentId` with approve/reject — similar to adjudication pattern

**Key learnings from story 10-3 (State Machine):**
- `isValidStepTransition()` is the ONLY way to validate transitions — DO NOT bypass
- TOCTOU: pre-check status + WHERE clause matching expected current status
- Valid transitions for background_check: `in_progress → complete`, `in_progress → pending_review`, `in_progress → rejected`, `pending_review → complete`, `pending_review → rejected`

**Files created/modified by story 12-1 that this story extends:**
- `server/api/lib/checkr.ts` (~170 lines) — `createAdverseAction()` already exported, this story calls it
- `server/api/lib/reconciliation.ts` (~80 lines) — enhance return type with details
- `server/api/routes/admin-providers.ts` (~1200+ lines) — add adjudication endpoint, enhance pipeline and detail responses
- `lib/notifications/index.ts` (~400+ lines) — add adjudication notification function
- `lib/constants.ts` (~170 lines) — add dashboard URL constant
- `server/api/lib/audit-logger.ts` (~100+ lines) — add adverse action audit type

### Git Intelligence Summary

| Commit | Relevance |
|---|---|
| `a19f0b3` Add provider registration links | Low — marketing links |
| `b4cc7d4` Fix Epic 10 bugs and XSS audit | Medium — confirms onboarding is stable |
| `9f1610a` Implement Epic 10 | Critical — onboarding pipeline base + state machine |
| `d5b600a` Harden Stripe integration | High — webhook patterns replicated in 12-1 |

**Key patterns from recent commits:**
- Audit logging on every state change (no exceptions)
- TOCTOU protection via WHERE clause guards
- Fire-and-forget notifications with error logging
- State machine validation before every transition

### Latest Technical Information

**Checkr API (as of March 2026):**
- Report statuses: `pending`, `clear`, `consider`, `complete`
- Adjudication values on report: `null`, `engaged`, `pre_adverse_action`, `post_adverse_action`
- Checkr Dashboard link: `https://dashboard.checkr.com/reports/{reportId}` (for admin to view full report)
- `POST /v1/adverse_actions` — creates adverse action; Checkr handles pre-adverse and final adverse action FCRA notices automatically
- `GET /v1/reports/{reportId}/assessments` — retrieves pre-adjudication assessment rules (optional — not needed for MVP but useful for future auto-adjudication)
- No separate webhook event for adjudication changes — adjudication state is part of `report.completed` or `report.updated` events, handled via the `adjudication` field on the report object

**Important FCRA Note:** When admin initiates adverse action via Checkr API, Checkr automatically handles:
1. Pre-adverse action notice (sent to candidate by Checkr)
2. Waiting period (typically 5-7 business days)
3. Final adverse action notice (sent by Checkr)
The platform does NOT need to manage FCRA notice timing — Checkr handles it entirely. The platform only needs to call `createAdverseAction()` and track the status.

### Project Structure Notes

- Adjudication endpoint goes in existing `server/api/routes/admin-providers.ts` — follows same pattern as `POST /:id/activate` and `POST /:id/reject`
- No new route file needed — architecture explicitly prohibits `server/api/routes/checkr.ts`
- Reconciliation enhancement is in-place modification of `server/api/lib/reconciliation.ts`
- No schema migration needed — adjudication data stored in existing `metadata` JSONB field
- Dispatch gating is already implemented via `requireOnboardingComplete` middleware — this story verifies it's correctly applied
- Pipeline grouping extends existing `GET /pipeline` query — no new component needed

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md` — Decision 2.1: requireOnboardingComplete Middleware]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Decision 2.2: Background Check Data Handling (FCRA)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Decision 3.1: Checkr Integration (Direct REST)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Decision 3.4: Polling Fallback Jobs]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — State Transition Authority Matrix]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Checkr Status Mapping (line ~1014)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Audit Action Types (line ~1149)]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — FR25: Admin views background check status]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — FR26: Admin initiates adverse action]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — FR27: Admin approves "consider" status]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — FR28: Dispatch gating until cleared]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — NFR-I2: No provider stuck >28h]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — NFR-I6: Zero orphaned states]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — NFR-S5: Minimal PII storage]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — NFR-S10: Audit trail for status transitions]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 12: Checkr Background Check Integration]
- [Source: `_bmad-output/implementation-artifacts/12-1-checkr-api-integration-and-webhook-processing.md` — All dev notes, code review fixes, file list]
- [Source: `server/api/lib/checkr.ts` — createAdverseAction() export (line ~154)]
- [Source: `server/api/lib/reconciliation.ts` — reconcileCheckrStatuses() with adjudication override]
- [Source: `server/api/routes/admin-providers.ts` — POST /reconcile/checkr endpoint (line ~1216)]
- [Source: `server/api/middleware/onboarding.ts` — requireOnboardingComplete middleware]
- [Source: `server/api/lib/audit-logger.ts` — checkr.adjudication_approved (line ~88)]
- [Source: `lib/constants.ts` — CHECKR_STATUS_MAP (lines 159-165)]
- [Source: Checkr API Docs — POST /v1/adverse_actions, GET /v1/reports/{id}, GET /v1/reports/{id}/assessments]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed WSEvent type: `"onboarding:provider_ready"` → `"onboarding:ready_for_review"` (correct type from `server/websocket/types.ts`)

### Completion Notes List

- Task 1: `POST /:id/adjudicate` endpoint added at line 1252 of admin-providers.ts. Handles both approve (→ complete) and adverse_action (→ rejected via Checkr API). TOCTOU guards on all updates. Checkr API failure returns 503 without state transition.
- Task 2: `GET /pipeline` enhanced with `background_check_review` stage. Providers with pending_review background_check step are routed there with checkrReportId and checkrDashboardUrl. `GET /:id` enhanced with backgroundCheckInfo object.
- Task 3: `reconcileCheckrStatuses()` now returns `ReconciliationDetail[]` in the `details` field. Adjudication override (`report.adjudication || report.status`) was already correct — verified, no changes needed. Notification dispatch added for reconciled status changes.
- Task 4: Dispatch gating verified — `requireOnboardingComplete` middleware already applied to all required routes (jobs, earnings, stats, invoices) via `server/api/index.ts` lines 45-50. Migration bypass logic works correctly. No code changes needed.
- Task 5: `checkr.adverse_action_initiated` added to AuditAction type. `CHECKR_DASHBOARD_BASE_URL` added to constants. `adjudicationRequestSchema` added to validators.
- Task 6: `notifyAdjudicationResult()` added with lazy imports to avoid circular deps. Follows fire-and-forget pattern.
- Task 7: 18 tests in `tests/unit/admin-adjudication.test.ts` — all passing. Full suite: 322 tests, 20 files, zero regressions.

### File List

**New files (1):**
- `tests/unit/admin-adjudication.test.ts` — 18 unit tests for adjudication, reconciliation, pipeline, validators

**Modified files (6):**
- `server/api/routes/admin-providers.ts` — POST /:id/adjudicate endpoint, enhanced GET /pipeline with background_check_review stage, enhanced GET /:id with backgroundCheckInfo
- `server/api/lib/reconciliation.ts` — ReconciliationDetail/ReconciliationResult interfaces, details array tracking, notification dispatch
- `server/api/lib/audit-logger.ts` — Added `checkr.adverse_action_initiated` to AuditAction type
- `lib/constants.ts` — Added `CHECKR_DASHBOARD_BASE_URL`
- `lib/validators.ts` — Added `adjudicationRequestSchema`
- `lib/notifications/index.ts` — Added `notifyAdjudicationResult()` and `notifyBackgroundCheckResult()` (from 12-1)

**Verified (no changes needed):**
- `server/api/middleware/onboarding.ts` — Dispatch gating correctly applied
- `server/api/lib/checkr.ts` — `createAdverseAction()` works as expected
- `server/api/index.ts` — Middleware applied to all dispatch-gated routes

# Story 14.2: Admin Activation, Rejection & Onboarding Notifications

Status: done

## Story

As an admin and provider,
I want activation/rejection flows to send proper notifications and all onboarding lifecycle events to trigger email/SMS/push alerts,
so that providers are informed at every step and admin is alerted when action is needed.

## Acceptance Criteria

### AC1: Provider rejection notification (FR44 gap)
**Given** an admin rejects a provider via POST `/:id/reject`
**When** the rejection is persisted
**Then** the provider receives an email with the rejection reason and a WebSocket event `onboarding:step_updated` with `newStatus: "rejected"`

### AC2: Application received notification (FR55)
**Given** a provider submits an application via POST `/apply` or POST `/invite-accept`
**When** the application is persisted and onboarding steps initialized
**Then** the provider receives email, SMS, and push notification confirming application receipt

### AC3: Step status change notification (FR56)
**Given** any onboarding step status changes (document reviewed, background check complete, training complete, Stripe Connect complete, activation)
**When** the status update is persisted
**Then** the provider receives an email notification about the status change
**Note:** Some notifications already exist (document review, background check, adjudication, activation email). This AC covers the remaining gaps: training completion, Stripe Connect completion, and a generic step-status-change dispatcher.

### AC4: Action required notification (FR57)
**Given** admin rejects a document or requests re-upload
**When** the rejection is persisted
**Then** the provider receives email AND SMS with the rejection reason and clear instructions to re-upload
**Note:** `notifyDocumentReviewed` already sends email. This AC adds SMS to that flow.

### AC5: Admin notification — provider ready for review (FR58)
**Given** a provider completes all onboarding steps and transitions to `pending_review`
**When** the auto-transition fires (in dashboard GET or `checkAllStepsCompleteAndTransition`)
**Then** admin receives email notification with provider name and a link to the pipeline view
**Note:** WebSocket `onboarding:ready_for_review` already broadcasts to admins. This AC adds email.

### AC6: Admin notification — new document submitted (FR59)
**Given** a provider uploads a new document
**When** the document record is created in `provider_documents`
**Then** admin receives email notification with provider name, document type, and a link to review
**Note:** WebSocket `onboarding:new_submission` already broadcasts. This AC adds email.

## Tasks / Subtasks

- [x] **Task 1: Add rejection notification to provider** (AC: 1)
  - [x] 1.1 Add `notifyProviderRejected` to `lib/notifications/index.ts` — email with rejection reason
  - [x] 1.2 Add WebSocket broadcast to provider in `admin-providers.ts` POST `/:id/reject`
  - [x] 1.3 Call `notifyProviderRejected` fire-and-forget in the reject endpoint

- [x] **Task 2: Add application received notification** (AC: 2)
  - [x] 2.1 Add `notifyApplicationReceived` to `lib/notifications/index.ts` — email + SMS + push
  - [x] 2.2 Add email template: "Application received, complete your onboarding"
  - [x] 2.3 Add SMS message: short confirmation with dashboard link
  - [x] 2.4 Call fire-and-forget in `onboarding.ts` POST `/apply` after successful transaction
  - [x] 2.5 Call fire-and-forget in `onboarding.ts` POST `/invite-accept` after successful transaction

- [x] **Task 3: Add remaining step status change notifications** (AC: 3)
  - [x] 3.1 Add `notifyTrainingCompleted` — email: "Training complete, check your dashboard"
  - [x] 3.2 Call in `onboarding.ts` POST `/training/acknowledge/:cardId` when `isAllAcknowledged`
  - [x] 3.3 Add `notifyStripeConnectCompleted` — email: "Payment setup complete"
  - [x] 3.4 Call in Stripe Connect completion paths (both webhook handler in webhooks.ts and return detection in onboarding.ts)

- [x] **Task 4: Add SMS to document rejection flow** (AC: 4)
  - [x] 4.1 Modify `notifyDocumentReviewed` in `lib/notifications/index.ts` to also send SMS when status is `rejected`
  - [x] 4.2 Look up user phone in the existing lazy-import pattern (already available from user query)
  - [x] 4.3 SMS message: "Your [docType] was not approved. Reason: [reason]. Please re-upload: [link]"

- [x] **Task 5: Add admin email for provider ready-for-review** (AC: 5)
  - [x] 5.1 Add `notifyAdminProviderReadyForReview` to `lib/notifications/index.ts` — email to admin
  - [x] 5.2 Look up admin email(s) from users table where role = 'admin'
  - [x] 5.3 Call fire-and-forget in `onboarding.ts` dashboard GET auto-transition block
  - [x] 5.4 Call fire-and-forget in `server/api/lib/all-steps-complete.ts`
  - [x] 5.5 Call fire-and-forget in `admin-providers.ts` document review and adjudication paths (2 locations)

- [x] **Task 6: Add admin email for new document submission** (AC: 6)
  - [x] 6.1 Add `notifyAdminNewDocumentSubmitted` to `lib/notifications/index.ts` — email to admin
  - [x] 6.2 Call fire-and-forget in `onboarding.ts` where `onboarding:new_submission` is already broadcast

- [x] **Task 7: Mobile parity — React Query hooks** (AC: all)
  - [x] 7.1 No new mobile endpoints needed — notifications are server-triggered
  - [x] 7.2 Verified: push notification added to `notifyApplicationReceived` using existing `sendPushNotification` pattern
  - [x] 7.3 Push notification added for application received event; other events use email/SMS which mobile receives natively

### Review Findings

- [x] [Review][Decision] `notifyProviderRejected` is email-only — SMS/push added for channel parity [lib/notifications/index.ts:407] — FIXED
- [x] [Review][Decision] `notifyTrainingCompleted` and `notifyStripeConnectCompleted` are email-only — SMS added [lib/notifications/index.ts:467,492] — FIXED
- [x] [Review][Patch] Sequential admin email loop in `notifyAdminProviderReadyForReview` — converted to `Promise.allSettled` [lib/notifications/index.ts:534] — FIXED
- [x] [Review][Patch] Sequential admin email loop in `notifyAdminNewDocumentSubmitted` — converted to `Promise.allSettled` [lib/notifications/index.ts:563] — FIXED
- [x] [Review][Patch] `notifyApplicationReceived` push notification `await` without error isolation — wrapped in `Promise.allSettled` [lib/notifications/index.ts:458] — FIXED
- [x] [Review][Patch] `notifyDocumentReviewed` SMS and email are sequential — converted to `Promise.allSettled` [lib/notifications/index.ts:182] — FIXED
- [x] [Review][Patch] Inconsistent null-coalescing: `provider.name` — added `|| ""` at all call sites — FIXED
- [x] [Review][Patch] Dashboard GET `notifyAdminProviderReadyForReview` — kept with clarifying comment (not duplicate: TOCTOU-guarded fallback path) — RESOLVED
- [x] [Review][Patch] Document review cascade at admin-providers.ts:1234 — added `.returning()` check + `if (transitioned)` guard — FIXED
- [x] [Review][Defer] Hardcoded fallback URL `https://roadsideatl.com` in 5+ locations — extract to constant — deferred, pre-existing pattern
- [x] [Review][Defer] Extra DB round-trip in `notifyProviderRejected` (caller has provider object) — deferred, minor perf
- [x] [Review][Defer] Dashboard auto-transition doesn't call `onStripeConnectStepComplete` — deferred, pre-existing architecture gap
- [x] [Review][Defer] `notifyDocumentReviewed` accepts arbitrary `status` string — deferred, latent type safety
- [x] [Review][Defer] `notifyBackgroundCheckResult` silent on unknown Checkr statuses — deferred, pre-existing

## Dev Notes

### What Already Exists (DO NOT RECREATE)

| Notification | File | What it does |
|---|---|---|
| `notifyDocumentReviewed` | `lib/notifications/index.ts:156` | Email on doc approve/reject — **needs SMS addition** |
| `notifyBackgroundCheckResult` | `lib/notifications/index.ts:185` | Email on Checkr status change — **complete** |
| `notifyAdjudicationResult` | `lib/notifications/index.ts:230` | Email on adjudication decision — **complete** |
| `notifyStripeConnectReminder` | `lib/notifications/index.ts:262` | Email + SMS for Stripe reminder — **complete** |
| `notifyPayoutComplete` | `lib/notifications/index.ts:306` | Email + SMS on payout — **complete** |
| Activation email | `admin-providers.ts:786` | Inline `sendEmail` on activate — **complete** |
| WS `onboarding:activated` | `admin-providers.ts:781` | Broadcast to provider on activate — **complete** |
| WS `onboarding:ready_for_review` | `admin-providers.ts:1229,1359` | Broadcast to admins — **needs email** |
| WS `onboarding:new_submission` | `onboarding.ts:1075` | Broadcast to admins — **needs email** |
| WS `onboarding:step_updated` | Multiple locations | Broadcast step changes — **complete** |

### Notification Pattern (MUST FOLLOW)

All notifications use the fire-and-forget pattern established in the codebase:

```typescript
// Pattern from lib/notifications/index.ts
export async function notifyXxx(args) {
  // Lazy imports to avoid circular dependencies
  const { db } = await import("@/db");
  const { users } = await import("@/db/schema/users");
  const { eq } = await import("drizzle-orm");

  // Look up user
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.email) return;

  // Send via channels
  const { sendEmail } = await import("./email");
  await sendEmail({ to: user.email, subject, html });

  // Optional SMS
  if (user.phone) {
    const { sendSMS } = await import("./sms");
    await sendSMS(user.phone, message);
  }
}
```

**Call site pattern:**
```typescript
notifyXxx(args).catch((err) => { console.error("[Notifications] Failed:", err); });
```

### Admin Email Lookup Pattern

For admin notifications (FR58, FR59), look up admin users:
```typescript
const { db } = await import("@/db");
const { users } = await import("@/db/schema/users");
const { eq } = await import("drizzle-orm");

const admins = await db.query.users.findMany({
  where: eq(users.role, "admin"),
});
// Send to each admin with email
```

### HTML Email Pattern

Use the existing inline HTML pattern (no template library). See `notifyDocumentReviewed` and `notifyBackgroundCheckResult` for examples. Always use `escapeHtml()` from the same file for user-supplied strings.

### File Locations

| What | Where |
|---|---|
| Notification dispatchers | `lib/notifications/index.ts` — add new exports here |
| Email sender | `lib/notifications/email.ts` — `sendEmail({ to, subject, html })` |
| SMS sender | `lib/notifications/sms.ts` — `sendSMS(phone, message)` |
| Push sender | `lib/notifications/push.ts` — existing push patterns |
| Admin provider routes | `server/api/routes/admin-providers.ts` — modify reject endpoint |
| Provider onboarding routes | `server/api/routes/onboarding.ts` — modify apply/invite-accept/training |
| All-steps-complete helper | `server/api/lib/all-steps-complete.ts` — may need notification call |
| WebSocket broadcast | `server/websocket/broadcast.ts` — `broadcastToAdmins`, `broadcastToUser` |
| Validators | `lib/validators.ts` — no new validators needed |

### Critical Rules

- **Fire-and-forget**: ALL notification calls must use `.catch((err) => { console.error("[Notifications] Failed:", err); })` — never await notifications in the request path
- **Lazy imports**: Use `await import()` pattern inside notification functions to avoid circular dependency chain (notifications → db → schema)
- **escapeHtml**: Always escape user-supplied strings (names, reasons) in HTML emails
- **No try-catch in route handlers**: Hono handles uncaught errors. Only wrap notification calls in fire-and-forget pattern.
- **updatedAt**: Always include `updatedAt: new Date()` in any `.update().set()` calls
- **Zod v4**: `import { z } from "zod/v4"` — not `from "zod"`
- **Named exports**: `export async function notifyXxx` — not default export

### Previous Story Intelligence (14-1)

Story 14-1 implemented the training module:
- `lib/training-content.ts` — `TRAINING_CARDS` array and `TOTAL_TRAINING_CARDS` count
- `components/onboarding/training-cards.tsx` — UI component for policy cards
- `app/(provider)/provider/onboarding/training/page.tsx` — training page
- Training endpoints in `onboarding.ts`: GET `/training` (line 705) and POST `/training/acknowledge/:cardId` (line 740)
- Training completion triggers `checkAllStepsCompleteAndTransition` which may auto-transition to `pending_review`
- The training acknowledge endpoint already has audit logging and WebSocket broadcast but **no email notification on training completion** — that's a gap this story fills

### Git Intelligence

Recent commit `30657a4` implemented 14-1. Files modified: `onboarding.ts`, `training-cards.tsx`, `step-card.tsx`, `training-content.ts`. The training endpoint pattern (acknowledge → check completion → broadcast) is the template for how notification hooks should be added.

### Project Structure Notes

- All new notification functions go in `lib/notifications/index.ts` — no new files needed
- No new routes needed — only modifications to existing endpoints
- No new DB schema changes needed
- No new components needed — this is purely backend notification wiring

### References

- [Source: _bmad-output/planning-artifacts/prd-provider-onboarding.md#Notifications & Communication] — FR55-FR59 definitions
- [Source: _bmad-output/planning-artifacts/prd-provider-onboarding.md#Admin Onboarding Pipeline] — FR43-FR44 definitions
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting Concerns] — Notification orchestration pattern (line ~898)
- [Source: _bmad-output/planning-artifacts/architecture.md#New Audit Actions] — Audit action naming conventions (line ~1140)
- [Source: _bmad-output/planning-artifacts/architecture.md#New WebSocket Events] — WebSocket event definitions (line ~1155)
- [Source: _bmad-output/project-context.md#Error Handling] — Fire-and-forget notification pattern
- [Source: lib/notifications/index.ts] — Existing notification hub with lazy import pattern
- [Source: server/api/routes/admin-providers.ts:743-841] — Existing activate/reject endpoints
- [Source: server/api/routes/onboarding.ts:704-841] — Training endpoints from 14-1

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- TypeScript compilation: clean (0 errors)
- ESLint: clean (0 errors on modified files)
- Test suite: 368/368 pass (1 pre-existing failure in stripe-checkout.test.ts unrelated to this story)
- New tests: 22/22 pass in onboarding-notifications.test.ts

### Completion Notes List

- Added 7 new notification functions to `lib/notifications/index.ts`: `notifyProviderRejected`, `notifyApplicationReceived`, `notifyTrainingCompleted`, `notifyStripeConnectCompleted`, `notifyAdminProviderReadyForReview`, `notifyAdminNewDocumentSubmitted`
- Modified `notifyDocumentReviewed` to add SMS on rejection (FR57)
- Wired rejection notification + WebSocket broadcast in admin-providers.ts reject endpoint
- Wired application received notification in both `/apply` and `/invite-accept` endpoints
- Wired training completion notification in training acknowledge endpoint
- Wired Stripe Connect completion notification in both onboarding.ts status check and webhooks.ts handler
- Wired admin ready-for-review email in 4 locations: onboarding.ts dashboard auto-transition, all-steps-complete.ts, admin-providers.ts document review cascade, admin-providers.ts adjudication cascade
- Wired admin new document submitted email alongside existing WebSocket broadcast
- All notifications follow fire-and-forget pattern with `.catch()` error logging
- All HTML uses `escapeHtml()` for user-supplied strings
- Updated 5 existing test files to mock new notification exports
- Created comprehensive test suite with 22 tests covering all new notification functions

### Change Log

- 2026-04-01: Implemented all onboarding lifecycle notifications (FR43-44, FR55-59). 7 tasks completed, 22 tests added.

### File List

- `lib/notifications/index.ts` — modified (added 7 notification functions, added SMS to doc rejection)
- `server/api/routes/admin-providers.ts` — modified (added rejection notification + WS broadcast, admin ready-for-review emails)
- `server/api/routes/onboarding.ts` — modified (added application received, training complete, Stripe complete, admin ready-for-review, admin new doc notifications)
- `server/api/routes/webhooks.ts` — modified (added Stripe Connect completion notification)
- `server/api/lib/all-steps-complete.ts` — modified (added admin ready-for-review notification)
- `tests/unit/onboarding-notifications.test.ts` — new (22 tests for notification functions)
- `tests/unit/onboarding-admin-providers.test.ts` — modified (added notification mocks)
- `tests/unit/admin-adjudication.test.ts` — modified (added notification mocks)
- `tests/unit/admin-document-review.test.ts` — modified (added notification mocks)
- `tests/unit/stripe-connect-onboarding.test.ts` — modified (added notification mocks)
- `tests/unit/all-steps-complete.test.ts` — modified (added notification mock)

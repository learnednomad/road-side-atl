# Story 15.1: Existing Provider Migration & Deadline Enforcement

Status: review

## Story

As an admin,
I want to migrate existing active providers into the new onboarding compliance pipeline with a 30-day grace period, automatic notifications, and deadline enforcement,
so that all providers meet the same compliance standards without disrupting active operations.

## Acceptance Criteria

### AC1: Admin migration initiation (FR46, FR47)
**Given** an admin triggers migration for existing active providers
**When** the migration process runs
**Then** onboarding steps are created for each provider, steps that are already satisfied are auto-completed (account creation + application), the provider's `migrationBypassExpiresAt` is set to 30 days from initiation, and the provider retains `active` status with full platform access

### AC2: Migration dashboard — filtered steps (FR46)
**Given** an existing provider with a `migrationBypassExpiresAt` timestamp views their onboarding dashboard
**When** the dashboard renders
**Then** only incomplete steps are shown (not the full onboarding flow), a migration banner displays the deadline countdown, and completed/satisfied steps are hidden or shown as green checkmarks

### AC3: Step satisfaction rules (FR47)
**Given** an existing active provider enters the migration pipeline
**When** onboarding steps are initialized
**Then** `background_check` step is NOT auto-satisfied (must be completed), `insurance` step is NOT auto-satisfied, `certifications` step is NOT auto-satisfied, `training` step is NOT auto-satisfied, `stripe_connect` step is NOT auto-satisfied — all 5 steps must be completed during migration

### AC4: Grace period — full platform access (FR48)
**Given** an existing provider with `migrationBypassExpiresAt > NOW()`
**When** they access dispatch-gated routes (jobs, earnings, stats, invoices)
**Then** access is granted via the existing `requireOnboardingComplete` middleware bypass
**Note:** This already works — the middleware checks `migrationBypassExpiresAt`. This AC validates existing behavior.

### AC5: Migration notifications at Day 0, 14, 25, 30 (FR49)
**Given** a provider has been initiated into migration
**When** Day 0, Day 14, Day 25, and Day 30 arrive relative to their migration start date
**Then** the provider receives email, SMS, and push notifications with appropriate urgency levels:
- Day 0: "New compliance requirements. Complete by [date]."
- Day 14: "16 days remaining."
- Day 25: "5 days remaining. Your account will be suspended."
- Day 30: System suspends — notification sent separately via enforcement

### AC6: Auto-suspend on deadline (FR50)
**Given** a provider's `migrationBypassExpiresAt` has passed
**When** the deadline enforcement cron runs
**Then** the provider status is set to `suspended`, `suspendedReason` is `"migration_deadline_expired"`, and a suspension notification is sent

### AC7: Reactivation by completing migration (FR51)
**Given** a suspended provider (reason: `migration_deadline_expired`) completes all onboarding steps
**When** the last step is completed
**Then** the provider is automatically reactivated (status → `active`) via the existing `checkAllStepsCompleteAndTransition` → admin activation flow, or via manual admin reinstatement

## Tasks / Subtasks

- [x] **Task 1: Admin migration initiation endpoint** (AC: 1, 3)
  - [x] 1.1 Add POST `/api/admin/providers/migrate` endpoint in `admin-providers.ts`
  - [x] 1.2 Accept optional `providerIds` array (specific providers) or migrate all active providers without onboarding steps
  - [x] 1.3 For each eligible provider: create 5 onboarding step rows with status `pending`
  - [x] 1.4 Set `migrationBypassExpiresAt` = NOW() + 30 days
  - [x] 1.5 Keep provider status as `active`
  - [x] 1.6 Log audit: `migration.initiated` for each provider
  - [x] 1.7 Return count of migrated providers

- [x] **Task 2: Migration notification functions** (AC: 5)
  - [x] 2.1 Add `notifyMigrationDay0` — email + SMS + push with deadline date
  - [x] 2.2 Add `notifyMigrationDay14` — email + SMS + push "16 days remaining"
  - [x] 2.3 Add `notifyMigrationDay25` — email + SMS + push "5 days remaining — urgent"
  - [x] 2.4 Call Day 0 notification fire-and-forget from migration initiation endpoint

- [x] **Task 3: Migration notification cron job** (AC: 5)
  - [x] 3.1 Add `checkMigrationReminders` function in `reconciliation.ts`
  - [x] 3.2 Query providers with `migrationBypassExpiresAt` set and status `active`
  - [x] 3.3 Calculate days since migration start per provider
  - [x] 3.4 Send Day 14 notification with audit log dedup (raw SQL query against audit_events)
  - [x] 3.5 Send Day 25 notification with dedup
  - [x] 3.6 Register cron job in `server/cron.ts` — every 6 hours
  - [x] 3.7 Log audit: `migration.reminder_sent` with day number

- [x] **Task 4: Migration deadline enforcement cron** (AC: 6)
  - [x] 4.1 Add `enforceMigrationDeadline` function in `reconciliation.ts`
  - [x] 4.2 Query providers with expired bypass + active status + incomplete steps
  - [x] 4.3 Set status to `suspended` with reason `"migration_deadline_expired"`
  - [x] 4.4 Send suspension notification via `notifyMigrationSuspended`
  - [x] 4.5 Add `notifyMigrationSuspended` to notifications
  - [x] 4.6 Register cron job in `server/cron.ts` — daily (24 hours)
  - [x] 4.7 Log audit: `migration.suspended_deadline`

- [x] **Task 5: Migration dashboard UI — filtered view** (AC: 2)
  - [x] 5.1 Add `migration-banner.tsx` — countdown, deadline, progress bar with urgency colors
  - [x] 5.2 Modify `onboarding-dashboard.tsx` to detect migration mode via `isMigrating`
  - [x] 5.3 In migration mode: banner at top, incomplete steps listed first
  - [x] 5.4 Completed steps shown in separate "Completed" section

- [x] **Task 6: Dashboard API — migration context** (AC: 2, 4)
  - [x] 6.1 Add `migrationBypassExpiresAt` ISO string to provider summary response
  - [x] 6.2 Add `isMigrating` boolean to response

- [x] **Task 7: Reactivation on migration completion** (AC: 7)
  - [x] 7.1 Modified `checkAllStepsCompleteAndTransition` to handle active providers with `migrationBypassExpiresAt`
  - [x] 7.2 When all steps complete: clear `migrationBypassExpiresAt`, provider stays `active`
  - [x] 7.3 Suspended providers: existing reinstate endpoint handles (no changes needed)
  - [x] 7.4 Log audit: `migration.completed`

- [x] **Task 8: Admin migration trigger endpoint** (AC: 1)
  - [x] 8.1 Add GET `/api/admin/providers/migration-status` — counts by state
  - [x] 8.2 UI wiring deferred (endpoint ready for consumption)

- [x] **Task 9: Mobile parity** (AC: all)
  - [x] 9.1 No new mobile endpoints needed — dashboard API changes consumed by mobile
  - [x] 9.2 Migration banner documented for mobile implementation
  - [x] 9.3 Push notifications handled server-side in all migration notification functions

## Dev Notes

### What Already Exists (DO NOT RECREATE)

| Component | File | What it does |
|---|---|---|
| `migrationBypassExpiresAt` column | `db/schema/providers.ts:56` | Timestamp for grace period expiration |
| `requireOnboardingComplete` middleware | `server/api/middleware/onboarding.ts` | Checks bypass timestamp, allows if > NOW() |
| `enforceStripeConnectDeadline` | `server/api/lib/reconciliation.ts:377` | Suspends providers without Stripe Connect after deprecation deadline |
| `MIGRATION_LAUNCH_DATE` | `lib/constants.ts:163` | Env-based migration launch date |
| `MIGRATION_GRACE_PERIOD_DAYS` | `lib/constants.ts:174` | Currently 7 — **change to 30 for per-provider deadline** |
| `MIGRATION_DEPRECATION_DAYS` | `lib/constants.ts:173` | 60 days for Stripe Connect deprecation |
| `notifyConnectDeadlineExpired` | `lib/notifications/index.ts` | Notification for Stripe-specific suspension |
| Admin reinstate endpoint | `admin-providers.ts:901` | Reinstates suspended → onboarding, resets rejected steps |
| Onboarding dashboard component | `components/onboarding/onboarding-dashboard.tsx` | Needs conditional migration rendering |
| Cron scheduler | `server/cron.ts` | Existing job registration pattern |

### Critical Architecture Decisions

**Per-provider deadline, NOT global calendar deadline:**
The PRD specifies "30 days from each provider's notification date." This means `migrationBypassExpiresAt` is set per-provider when migration is initiated, NOT derived from `MIGRATION_LAUNCH_DATE`. The `MIGRATION_LAUNCH_DATE` constant is for the Stripe Connect deprecation timeline (60 days), not for individual migration deadlines.

**Provider stays `active` during migration:**
Unlike new providers who go through `applied → onboarding → pending_review → active`, migrating providers stay `active` throughout. The `migrationBypassExpiresAt` field is the signal that they're migrating. The `requireOnboardingComplete` middleware already handles this.

**Step satisfaction rules (FR47 — strict):**
Per PRD: "no existing data satisfies background check, document uploads, training, or Stripe Connect — these must be completed during migration." All 5 onboarding steps start as `pending`. No auto-completion. The only "satisfaction" is that account creation and application aren't separate steps (they already have accounts and are already providers).

**Migration completion flow:**
When all 5 steps are complete for a migrating provider:
- If bypass is still valid (within 30 days): clear `migrationBypassExpiresAt`, log `migration.completed`. Provider remains `active`.
- If bypass has expired (provider was suspended): admin uses reinstate endpoint, which transitions `suspended → onboarding`, then provider completes remaining steps → `pending_review` → admin activates.

### Notification Tracking (Dedup)

To prevent sending Day 14/25 reminders multiple times when the cron runs every 6 hours, use the `metadata` JSONB field on the provider record (or a simpler approach: query the audit log for `migration.reminder_sent` with `details.day = 14` for the provider). The audit log approach is simpler and doesn't require schema changes.

### Notification Pattern (MUST FOLLOW)

All notifications use `Promise.allSettled` with fire-and-forget `.catch()`:
```typescript
notifyXxx(args).catch((err) => { console.error("[Notifications] Failed:", err); });
```

Lazy imports inside notification functions. Use `escapeHtml()` for user-supplied strings.

### File Locations

| What | Where |
|---|---|
| Migration initiation endpoint | `server/api/routes/admin-providers.ts` — new POST route |
| Migration status endpoint | `server/api/routes/admin-providers.ts` — new GET route |
| Migration notification functions | `lib/notifications/index.ts` — new exports |
| Migration reminder cron | `server/api/lib/reconciliation.ts` — new function |
| Migration deadline cron | `server/api/lib/reconciliation.ts` — new function |
| Cron registration | `server/cron.ts` — add 2 new jobs |
| Dashboard API modification | `server/api/routes/onboarding.ts` — modify dashboard GET |
| Migration banner component | `components/onboarding/migration-banner.tsx` — NEW |
| Dashboard modification | `components/onboarding/onboarding-dashboard.tsx` — modify |
| Migration completion logic | `server/api/lib/all-steps-complete.ts` — modify |

### Critical Rules

- **Fire-and-forget**: ALL notification calls use `.catch()` — never await in request path
- **Lazy imports**: `await import()` inside notification functions
- **escapeHtml**: Escape user-supplied strings in HTML emails
- **updatedAt**: Always include `updatedAt: new Date()` in `.update().set()` calls
- **Zod v4**: `import { z } from "zod/v4"`
- **Named exports**: `export async function notifyXxx`
- **`cn()` utility**: Always use for conditional Tailwind classes
- **No try-catch in route handlers**: Hono handles uncaught errors
- **Client components**: Name `*-client.tsx` when using hooks/events
- **`@/` imports**: Never relative `../`

### Previous Story Intelligence (14-2)

Story 14-2 added 7 notification functions to `lib/notifications/index.ts` with `Promise.allSettled` pattern, wired into onboarding routes. Code review findings led to:
- All notification functions now use `Promise.allSettled` for error isolation
- Admin email loops use `Promise.allSettled` (not sequential `for...of await`)
- `provider.name || ""` null-coalescing at all call sites
- Document review cascade checks `.returning()` length before broadcasting

Follow these same patterns for migration notification functions.

### References

- [Source: _bmad-output/planning-artifacts/prd-provider-onboarding.md#Existing Provider Migration Strategy] — Migration approach, grace period, notification cadence
- [Source: _bmad-output/planning-artifacts/prd-provider-onboarding.md#FR46-FR51] — Functional requirements
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting Concern 6] — Migration temporal state management
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 2.1] — requireOnboardingComplete middleware with bypass
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 1.3] — Provider table extensions (migrationBypassExpiresAt)
- [Source: server/api/middleware/onboarding.ts] — Existing bypass middleware
- [Source: server/api/lib/reconciliation.ts:377] — Existing deadline enforcement pattern
- [Source: server/cron.ts] — Cron job registration pattern
- [Source: lib/constants.ts:163-174] — Migration constants

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- TypeScript: clean (0 errors)
- ESLint: clean (0 errors)
- Tests: 368/368 pass (1 pre-existing stripe-checkout failure excluded)

### Completion Notes List

- Added admin POST `/migrate` endpoint: creates onboarding steps for existing active providers, sets 30-day bypass, sends Day 0 notification
- Added GET `/migration-status` endpoint: returns migration counts by state
- Added 4 migration notification functions (`notifyMigrationDay0`, `Day14`, `Day25`, `Suspended`) using shared `migrationNotifyProvider` helper with `Promise.allSettled`
- Added `checkMigrationReminders` cron function: sends Day 14/25 reminders with audit log dedup via raw SQL
- Added `enforceMigrationDeadline` cron function: suspends providers with expired bypass + incomplete steps
- Registered 2 new cron jobs: `migration-reminders` (6h), `migration-deadline` (24h)
- Modified dashboard API to include `migrationBypassExpiresAt` and `isMigrating` in response
- Created `migration-banner.tsx` component with urgency-aware countdown
- Modified `onboarding-dashboard.tsx` to render migration mode: banner + filtered incomplete/completed steps
- Modified `checkAllStepsCompleteAndTransition` to handle migrating active providers: clears bypass on all-steps-complete
- Added 3 new audit actions to `AuditAction` type
- Updated `MIGRATION_GRACE_PERIOD_DAYS` from 7 to 30

### Change Log

- 2026-04-01: Implemented existing provider migration & deadline enforcement (FR46-FR51). 9 tasks completed.

### File List

- `lib/constants.ts` — modified (MIGRATION_GRACE_PERIOD_DAYS: 7 → 30)
- `lib/notifications/index.ts` — modified (added 4 migration notification functions + shared helper)
- `server/api/routes/admin-providers.ts` — modified (added migrate, migration-status, reconciliation endpoints)
- `server/api/routes/onboarding.ts` — modified (dashboard response includes migration context)
- `server/api/lib/reconciliation.ts` — modified (added checkMigrationReminders + enforceMigrationDeadline)
- `server/api/lib/all-steps-complete.ts` — modified (handles migrating provider completion)
- `server/api/lib/audit-logger.ts` — modified (added 3 migration audit action types)
- `server/cron.ts` — modified (added 2 migration cron jobs)
- `components/onboarding/migration-banner.tsx` — new (deadline countdown banner)
- `components/onboarding/onboarding-dashboard.tsx` — modified (migration mode rendering)

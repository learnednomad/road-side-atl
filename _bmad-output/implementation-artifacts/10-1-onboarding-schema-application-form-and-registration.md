# Story 10.1: Onboarding Schema, Application Form & Registration

Status: done

## Story

As a prospective provider,
I want to apply to join RoadSide ATL by submitting my details and creating an account,
so that I can enter the onboarding pipeline and begin the process of becoming an active provider.

## Acceptance Criteria

1. **Given** the database has the existing providers table, **When** the migration runs, **Then** `providerStatusEnum` is extended with `applied`, `onboarding`, `pending_review`, `rejected`, `suspended` values, **And** new nullable columns are added to providers: `stripeConnectAccountId` (text), `migrationBypassExpiresAt` (timestamp), `activatedAt` (timestamp), `suspendedAt` (timestamp), `suspendedReason` (text), `previousApplicationId` (text), **And** existing provider records retain their current status and data.

2. **Given** no onboarding tables exist, **When** the migration runs, **Then** an `onboarding_steps` table is created with columns: `id` (text PK), `providerId` (text FK), `stepType` (enum: `background_check`, `insurance`, `certifications`, `training`, `stripe_connect`), `status` (enum: `pending`, `draft`, `in_progress`, `pending_review`, `complete`, `rejected`, `blocked`), `draftData` (JSONB nullable), `metadata` (JSONB nullable), `completedAt` (timestamp nullable), `reviewedBy` (text nullable), `reviewedAt` (timestamp nullable), `rejectionReason` (text nullable), `createdAt`, `updatedAt`, **And** a `provider_documents` table is created with columns: `id` (text PK), `providerId` (text FK), `onboardingStepId` (text FK), `documentType` (enum: `insurance`, `certification`, `vehicle_doc`), `s3Key` (text), `originalFileName` (text), `fileSize` (integer), `mimeType` (text), `status` (enum: `pending_review`, `approved`, `rejected`), `rejectionReason` (text nullable), `reviewedBy` (text nullable), `reviewedAt` (timestamp nullable), `expiresAt` (timestamp nullable), `createdAt`, `updatedAt`.

3. **Given** a visitor on the "Become a Provider" page, **When** they submit the application form with valid name, email, password, phone, service area, specialties, and FCRA consent checkbox, **Then** a user account is created with role `provider`, a provider record is created with status `applied`, 5 onboarding step rows are initialized (one per step type, all status `pending`), an immutable FCRA consent audit record is logged via `logAudit("onboarding.fcra_consent", { providerId, timestamp, ipAddress, consentVersion })`, the background_check step is set to `in_progress`, **And** the provider is redirected to the onboarding dashboard.

4. **Given** an admin has sent an invite to an email address, **When** the invited provider clicks the invite link and creates their account, **Then** their email is pre-filled from the invite token, they create a password and complete the same application form, they enter the identical onboarding pipeline as self-registered providers, **And** the invite token is marked as used.

5. **Given** a provider has submitted an application, **When** the system processes it, **Then** `logAudit("onboarding.step_started")` is called for the background_check step, the step metadata is prepared for future Checkr integration (`{ checkrCandidateId: null, checkrReportId: null, checkrInvitationId: null }`), **And** the provider status transitions from `applied` to `onboarding`.

6. **Given** any user attempts to submit an application, **When** the FCRA consent checkbox is not checked, **Then** the form submission is rejected with a validation error, **And** no user/provider/step records are created.

## Tasks / Subtasks

- [x] Task 1: Create onboarding schema files and extend providers (AC: 1, 2)
  - [x] 1.1 Create `db/schema/onboarding-steps.ts` with `stepTypeEnum`, `stepStatusEnum`, and `onboardingSteps` table definition
  - [x] 1.2 Create `db/schema/provider-documents.ts` with `documentTypeEnum`, `documentStatusEnum`, and `providerDocuments` table definition
  - [x] 1.3 Extend `providerStatusEnum` in `db/schema/providers.ts` with 5 new values: `applied`, `onboarding`, `pending_review`, `rejected`, `suspended`
  - [x] 1.4 Add 6 new nullable columns to `providers` table: `stripeConnectAccountId`, `migrationBypassExpiresAt`, `activatedAt`, `suspendedAt`, `suspendedReason`, `previousApplicationId`
  - [x] 1.5 Add `export * from "./onboarding-steps"` and `export * from "./provider-documents"` to `db/schema/index.ts`
  - [x] 1.6 Run `npm run db:generate` to create migration file
  - [x] 1.7 Run `npm run db:push` to apply schema changes and verify all existing data intact

- [x] Task 2: Add onboarding constants and validators (AC: 3, 6)
  - [x]2.1 Add to `lib/constants.ts`: `ONBOARDING_STEP_TYPES`, `ONBOARDING_STEP_STATUSES`, `DOCUMENT_TYPES`, `DOCUMENT_STATUSES`, `PROVIDER_ONBOARDING_STATUSES` arrays with `as const` + derived types
  - [x]2.2 Add to `lib/constants.ts`: `TRAINING_TOPICS` array with 5-7 topic slugs (dispatch_protocol, safety_procedures, cancellation_policy, payment_terms, service_area, platform_terms)
  - [x]2.3 Add to `lib/validators.ts`: `providerApplicationSchema` — validates name, email, password, phone, serviceArea (string[]), specialties (string[]), fcraConsent (boolean, must be true)
  - [x]2.4 Add to `lib/validators.ts`: `inviteAcceptSchema` — validates inviteToken, password, phone, serviceArea, specialties, fcraConsent

- [x] Task 3: Add onboarding audit action types (AC: 3, 5)
  - [x]3.1 Extend `AuditAction` type union in `server/api/lib/audit-logger.ts` with onboarding actions: `onboarding.fcra_consent`, `onboarding.step_started`, `onboarding.step_completed`, `onboarding.step_rejected`, `onboarding.activated`, `onboarding.suspended`, `onboarding.rejected`, `onboarding.migration_bypass`, `document.uploaded`, `document.approved`, `document.rejected`, `document.resubmitted`, `checkr.candidate_created`, `checkr.report_received`, `checkr.adjudication_approved`, `stripe_connect.account_created`, `stripe_connect.onboarding_completed`, `stripe_connect.link_generated`, `training.card_acknowledged`, `training.module_completed`, `migration.initiated`, `migration.completed`, `migration.suspended_deadline`

- [x] Task 4: Create provider onboarding API route module (AC: 3, 4, 5, 6)
  - [x]4.1 Create `server/api/routes/onboarding.ts` with Hono app instance
  - [x]4.2 Implement `POST /apply` — public endpoint (no auth middleware): validate body with `providerApplicationSchema`, hash password with bcryptjs, create user (role: provider), create provider (status: applied), create 5 onboarding step rows (all pending), log FCRA consent via `logAudit`, set background_check step to `in_progress` with empty Checkr metadata, transition provider status to `onboarding`, return `{ provider, steps }` with 201
  - [x]4.3 Implement `POST /invite-accept` — public endpoint: validate invite token (lookup from admin_invites or similar mechanism), validate body with `inviteAcceptSchema`, create user with pre-filled email, follow same pipeline as apply (create provider, steps, FCRA log, etc.), mark invite token as used, return `{ provider, steps }` with 201
  - [x]4.4 Register route in `server/api/index.ts`: `app.route("/onboarding", onboardingRoutes)`
  - [x]4.5 Apply `rateLimitStrict` middleware on both public endpoints to prevent abuse

- [x] Task 5: Create admin invite endpoint (AC: 4)
  - [x]5.1 Add `POST /invites` endpoint to `server/api/routes/admin-providers.ts` — accepts email and name, generates unique invite token (crypto.randomUUID()), stores token with email/name/createdBy/usedAt fields, sends invite email via existing notification system, returns `{ inviteToken, email }` with 201
  - [x]5.2 Add `inviteProviderSchema` validator to `lib/validators.ts` — validates email and name
  - [x]5.3 Decide invite storage: add `provider_invites` columns to a simple tracking mechanism or use a lightweight JSONB approach in an existing table. Prefer a dedicated `provider_invites` table if clean separation is needed.

- [x] Task 6: Create application page UI (AC: 3, 6)
  - [x]6.1 Create `app/(marketing)/become-provider/page.tsx` — server component shell with page title and meta
  - [x]6.2 Create `components/onboarding/application-form.tsx` — client component with react-hook-form + Zod resolver, fields: name, email, password, phone, service area (multi-select or comma-separated), specialties (checkboxes from constants), FCRA consent checkbox with legal text, submit button
  - [x]6.3 On successful submission: auto-login the user (call signIn from NextAuth), redirect to `/provider/onboarding`
  - [x]6.4 Handle validation errors (Zod) and server errors (duplicate email, etc.) with toast notifications

- [x] Task 7: Write tests for onboarding application flow (AC: 1-6)
  - [x]7.1 Create `__tests__/onboarding-apply.test.ts` — unit tests for: providerApplicationSchema validation (valid, missing fields, fcraConsent=false), inviteAcceptSchema validation
  - [x]7.2 Create `__tests__/onboarding-routes.test.ts` — integration tests using Hono app.request(): POST /api/onboarding/apply (success, validation failure, duplicate email, missing FCRA consent), POST /api/onboarding/invite-accept (valid token, expired token, used token)
  - [x]7.3 Verify: 5 onboarding steps created on successful application, provider status transitions to `onboarding`, FCRA consent audit log entry exists, background_check step status is `in_progress`

## Dev Notes

### Technical Requirements

**Schema — onboarding_steps table:**
```typescript
export const stepTypeEnum = pgEnum("step_type", [
  "background_check", "insurance", "certifications", "training", "stripe_connect",
]);

export const stepStatusEnum = pgEnum("step_status", [
  "pending", "draft", "in_progress", "pending_review", "complete", "rejected", "blocked",
]);

export const onboardingSteps = pgTable("onboarding_steps", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  providerId: text("providerId").notNull().references(() => providers.id),
  stepType: stepTypeEnum("stepType").notNull(),
  status: stepStatusEnum("status").notNull().default("pending"),
  draftData: jsonb("draftData").$type<Record<string, unknown>>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  completedAt: timestamp("completedAt", { mode: "date" }),
  reviewedBy: text("reviewedBy"),
  reviewedAt: timestamp("reviewedAt", { mode: "date" }),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
```

**Schema — provider_documents table:**
```typescript
export const documentTypeEnum = pgEnum("document_type", [
  "insurance", "certification", "vehicle_doc",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "pending_review", "approved", "rejected",
]);

export const providerDocuments = pgTable("provider_documents", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  providerId: text("providerId").notNull().references(() => providers.id),
  onboardingStepId: text("onboardingStepId").notNull().references(() => onboardingSteps.id),
  documentType: documentTypeEnum("documentType").notNull(),
  s3Key: text("s3Key").notNull(),
  originalFileName: text("originalFileName").notNull(),
  fileSize: integer("fileSize").notNull(),
  mimeType: text("mimeType").notNull(),
  status: documentStatusEnum("status").notNull().default("pending_review"),
  rejectionReason: text("rejectionReason"),
  reviewedBy: text("reviewedBy"),
  reviewedAt: timestamp("reviewedAt", { mode: "date" }),
  expiresAt: timestamp("expiresAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
```

**Provider table extensions** — add to existing `providers` table in `db/schema/providers.ts`:
```typescript
stripeConnectAccountId: text("stripeConnectAccountId"),
migrationBypassExpiresAt: timestamp("migrationBypassExpiresAt", { mode: "date" }),
activatedAt: timestamp("activatedAt", { mode: "date" }),
suspendedAt: timestamp("suspendedAt", { mode: "date" }),
suspendedReason: text("suspendedReason"),
previousApplicationId: text("previousApplicationId"),
```

**Enum extension** — The `providerStatusEnum` currently has `["active", "inactive", "pending", "resubmission_requested"]`. Add: `"applied", "onboarding", "pending_review", "rejected", "suspended"`. Note: Drizzle pgEnum does not support runtime extension — you must edit the source enum array directly and generate a migration. The migration will be an `ALTER TYPE ... ADD VALUE` statement.

**FCRA consent** — MUST be recorded ONLY via `logAudit()`. Never store as a provider column. The audit record is immutable.

**Application flow — transactional:**
The apply endpoint must be transactional (use `db.transaction()`). If any step fails (user creation, provider creation, step initialization), the entire operation rolls back. No orphaned users without provider records.

**Password hashing:** Use `bcryptjs` (already in dependencies) — `import bcrypt from "bcryptjs"` then `bcrypt.hash(password, 10)`.

**Invite mechanism:** The simplest approach is a `provider_invites` table with columns: `id`, `email`, `name`, `token` (unique), `createdBy` (admin user ID), `usedAt` (nullable timestamp), `expiresAt` (timestamp), `createdAt`. Keep it minimal. Create `db/schema/provider-invites.ts`.

### Architecture Compliance

| Rule | Compliance |
|---|---|
| All API routes via Hono, NOT app/api/ | Create `server/api/routes/onboarding.ts`, register in `server/api/index.ts` |
| Zod v4: `import { z } from "zod/v4"` | All validators use correct import |
| IDs: text PK with `createId()` | All new tables follow pattern |
| `updatedAt: new Date()` in every `.update().set()` | Include in all update operations |
| Destructure `.returning()` | `const [result] = await db.insert(...).returning()` |
| Barrel export schemas | Add to `db/schema/index.ts` |
| Constants in `lib/constants.ts` | Append onboarding constants there |
| Validators in `lib/validators.ts` | Append application schemas there |
| Audit logging for state changes | `logAudit()` on every status transition |
| Named exports for components | `export function ApplicationForm()` not default |
| `@/` path alias | All imports use `@/` prefix |
| No try-catch in route handlers | Hono handles errors |
| Fire-and-forget notifications | `.catch((err) => { console.error("[Notifications] Failed:", err); })` |

### Library & Framework Requirements

| Library | Version | Usage in This Story |
|---|---|---|
| Drizzle ORM | ^0.45.1 | Schema definitions, migrations, queries |
| drizzle-kit | ^0.31.8 | `db:generate` for migration files |
| postgres | (postgres.js) | DB driver — NOT `pg` |
| Hono | ^4.11.7 | Route module for `/api/onboarding/*` |
| Zod | ^4.3.6 | `import { z } from "zod/v4"` — application validators |
| bcryptjs | (existing) | Password hashing for new accounts |
| NextAuth v5 | ^5.0.0-beta.30 | `auth()` function, NOT `getServerSession()` |
| react-hook-form | ^7.71.1 | Application form with Zod resolver |
| sonner | (existing) | Toast notifications for form errors/success |

**No new npm dependencies required.** All libraries already installed.

### File Structure Requirements

**New files (6):**
- `db/schema/onboarding-steps.ts` — onboarding_steps table + stepType + stepStatus enums
- `db/schema/provider-documents.ts` — provider_documents table + documentType + documentStatus enums
- `db/schema/provider-invites.ts` — provider_invites table for invite tracking
- `server/api/routes/onboarding.ts` — provider-facing onboarding API endpoints
- `app/(marketing)/become-provider/page.tsx` — public application page
- `components/onboarding/application-form.tsx` — client component application form

**Modified files (6):**
- `db/schema/providers.ts` — extend providerStatusEnum, add 6 columns
- `db/schema/index.ts` — add 3 new exports
- `server/api/index.ts` — register onboarding route module
- `lib/constants.ts` — add onboarding constants
- `lib/validators.ts` — add application validators
- `server/api/lib/audit-logger.ts` — add onboarding audit action types

**What NOT to create:**
- No `lib/onboarding/` directory — domain logic lives in route handlers
- No `types/onboarding.d.ts` — types co-located in schema files or inferred from Zod
- No `components/provider/application-form.tsx` — onboarding components go in `components/onboarding/`
- No `app/api/onboarding/` — all routes through Hono

### Testing Requirements

**Test framework:** Vitest 4.0.18 (installed)

**Unit tests:**
1. `providerApplicationSchema` — valid data passes, missing name fails, invalid email fails, fcraConsent=false fails, empty serviceArea fails
2. `inviteAcceptSchema` — valid data passes, missing token fails, fcraConsent=false fails

**Integration tests (Hono app.request()):**
3. POST /api/onboarding/apply — success: returns 201, provider created with status `onboarding`, 5 steps initialized
4. POST /api/onboarding/apply — duplicate email: returns 400/409
5. POST /api/onboarding/apply — missing FCRA consent: returns 400, no records created
6. POST /api/onboarding/apply — verify audit log contains `onboarding.fcra_consent` entry
7. POST /api/onboarding/invite-accept — valid token: returns 201, email pre-filled, enters pipeline
8. POST /api/onboarding/invite-accept — used token: returns 400
9. POST /api/admin/providers/invites — creates invite with token, sends email notification

### Git Intelligence Summary

| Commit | Relevance |
|---|---|
| `4612bce` Fix remaining lint errors | Medium — establishes lint baseline, don't introduce new lint errors |
| `b27bfda` Fix lint errors: setState-in-effect | Medium — avoid setState-in-effect pattern in application form |
| `16fde76` Add collapsible sidebars, redesign admin | Low — UI patterns for reference |
| `6a0e36d` Harden Stripe integration | High — webhook patterns relevant for future Checkr/Stripe Connect stories |
| `1ac1750` Add unit test suite with Vitest | Critical — Vitest is the test framework, follow existing test patterns |

### Existing Infrastructure Leveraged

| Component | File | How It Helps |
|---|---|---|
| Auth system | `lib/auth.ts`, `lib/auth.config.ts` | User creation follows existing NextAuth patterns |
| Audit logger | `server/api/lib/audit-logger.ts` | FCRA consent and state transitions |
| Rate limiter | `server/api/middleware/rate-limit.ts` | Apply to public apply endpoint |
| Notification hub | `lib/notifications/index.ts` | Send invite emails, application confirmations |
| S3 upload pattern | Existing presigned URL pattern | Reference for future document upload stories |
| Existing providers route | `server/api/routes/admin-providers.ts` | Pattern for admin invite endpoint |
| Schema utils | `db/schema/utils.ts` | `createId()` function for text PKs |
| bcryptjs | Already in deps | Password hashing — same pattern as existing auth |

### Project Structure Notes

- This story creates the **foundational schema** that all subsequent Provider Onboarding stories (10-2 through 15-1) depend on
- The onboarding route module (`server/api/routes/onboarding.ts`) will be extended by stories 10-2 (dashboard endpoints), 11-1 (document upload), etc.
- The `components/onboarding/` folder is created here and will house 7+ components across subsequent stories
- Provider status enum extensions affect queries in `admin-providers.ts` — existing queries using status filters should not break (new values are additive)
- The `provider_invites` table is a lightweight addition — consider if it could be a JSONB column on providers, but a separate table is cleaner for admin querying

### References

- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — FR1-FR6, NFR-S4, NFR-S5]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Provider Onboarding Extension: Decision 1.1 (onboarding_steps), Decision 1.2 (provider_documents), Decision 1.3 (provider table extensions), Decision 1.4 (step initialization)]
- [Source: `docs/project-context.md` — 127 rules, Adding New Features Checklist, Anti-Patterns]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — State Transition Authority Matrix, Cross-Cutting Concerns #1-7]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- TypeScript type errors required updating admin provider components for new status enum values
- Existing `providerInviteTokens` system was preserved; new `provider_invites` table created for onboarding-specific invites
- Migration 0019 includes some unrelated schema drift from prior feature branches (business_settings, invoice changes)

### Completion Notes List

- All 7 tasks and subtasks implemented and verified
- 3 new schema files created: onboarding-steps, provider-documents, provider-invites
- providerStatusEnum extended with 5 new values (applied, onboarding, pending_review, rejected, suspended)
- 6 new columns added to providers table
- Onboarding API route module with /apply and /invite-accept endpoints (fully transactional including pipeline setup)
- Admin invite endpoint added to admin-providers.ts (POST /invites) with duplicate invite guard
- FCRA consent recorded exclusively via logAudit (never as a provider column)
- Background_check step auto-set to in_progress with Checkr metadata placeholder (inside transaction)
- Application form with FCRA consent checkbox, specialties selection, service area input
- Invite flow uses `.omit()` on providerApplicationSchema to skip name/email validation
- Shared `initializeOnboardingPipeline` helper eliminates code duplication between /apply and /invite-accept
- Duplicate provider check added to /invite-accept endpoint
- Onboarding invite email uses correct `/become-provider?invite=` URL (not the old invite system's URL)
- Auto-login extracts email from API response for invite flow
- Suspense boundary wraps ApplicationForm for proper Next.js 16 SSR
- TOCTOU race condition handled with try-catch on unique constraint violations
- 17 unit tests for validator schemas + 16 integration tests for route handlers (all passing)
- Full regression suite: 157 tests pass (0 failures)
- TypeScript: 0 errors
- ESLint: 0 errors, 0 warnings

### Change Log

- 2026-03-04: Implemented story 10-1 — schema, API routes, UI, tests
- 2026-03-04: Code review round 1 fixes — transactional pipeline, invite form validation, integration tests, duplicate guards
- 2026-03-04: Code review round 2 fixes — invite email URL, auto-login, Suspense boundary, TOCTOU handling

### File List

**New files (9):**
- `db/schema/onboarding-steps.ts`
- `db/schema/provider-documents.ts`
- `db/schema/provider-invites.ts`
- `db/migrations/0019_brief_wolfpack.sql`
- `server/api/routes/onboarding.ts`
- `app/(marketing)/become-provider/page.tsx`
- `components/onboarding/application-form.tsx`
- `tests/unit/onboarding-validators.test.ts`
- `tests/unit/onboarding-routes.test.ts`

**Modified files (10):**
- `db/schema/providers.ts` — extended providerStatusEnum, added 6 columns
- `db/schema/index.ts` — added 3 barrel exports
- `server/api/index.ts` — registered onboarding route
- `server/api/routes/admin-providers.ts` — added POST /invites endpoint with onboarding-specific email
- `server/api/lib/audit-logger.ts` — added 24 onboarding audit action types
- `lib/constants.ts` — added onboarding constants and types
- `lib/validators.ts` — added providerApplicationSchema, inviteAcceptSchema, onboardingInviteSchema
- `components/admin/providers-table.tsx` — updated statusVariant map for new statuses
- `components/admin/provider-form.tsx` — updated status enum in local Zod schema
- `app/(admin)/admin/providers/[id]/page.tsx` — updated statusVariant map

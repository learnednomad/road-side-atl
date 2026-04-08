---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics']
inputDocuments:
  - _bmad-output/planning-artifacts/prd-provider-onboarding.md
  - _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md
  - _bmad-output/planning-artifacts/architecture.md
---

# road-side-atl - Unified Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for road-side-atl, decomposing requirements from all PRDs and Architecture into implementable stories.

| Initiative | PRD | Epics | Status |
|---|---|---|---|
| Provider Onboarding | `prd-provider-onboarding.md` | 1–8 (sprint-status: 10–15) | In progress |
| Mobile Mechanics + Beta + Mobile Parity | `prd-mobile-mechanics-beta.md` | 16–19 | In progress |

## Requirements Inventory

### Functional Requirements

**1. Provider Application & Registration**
- FR1: Prospective provider can submit an application with personal info, contact details, service area, and specialties
- FR2: Prospective provider can create an account during application with email and password
- FR3: Invited provider can accept an invite link and create an account with pre-filled email
- FR4: Prospective provider can give explicit FCRA consent for background check during application (checkbox + timestamp recorded)
- FR5: System initiates background check automatically upon application submission with valid consent
- FR6: Both invited and self-registered providers enter the same unified onboarding pipeline

**2. Onboarding Progress Management**
- FR7: Provider can view an onboarding dashboard showing all required steps with current status for each
- FR8: Provider can complete onboarding steps in any order
- FR9: Provider can resume onboarding from any device with progress preserved
- FR10: Provider's onboarding dashboard updates in real-time when step statuses change
- FR11: System tracks provider onboarding state through defined statuses: applied → onboarding → pending_review → active / rejected / suspended
- FR12: System prevents providers with incomplete onboarding from accessing the full provider portal (jobs, earnings, stats)

**3. Document Upload & Review**
- FR13: Provider can upload documents (insurance, certifications) using camera capture from mobile device
- FR14: Provider can preview a captured photo and choose to retake or submit before uploading
- FR15: Provider can see document-type-specific guidance before capturing (what a valid document looks like)
- FR16: Provider can see per-document status independently: not uploaded, uploading, pending review, approved, rejected with reason
- FR17: Provider can re-upload a document after rejection with the rejection reason visible
- FR18: System automatically retries failed uploads
- FR19: Admin can view an uploaded document image with zoom capability
- FR20: Admin can approve or reject a document with a required reason for rejection
- FR21: Provider receives notification (email + push) when a document is approved or rejected

**4. Background Check (Checkr Integration)**
- FR22: System creates a Checkr candidate and initiates criminal + MVR check upon provider consent
- FR23: System receives and processes Checkr webhook status updates (clear, consider, suspended, adverse_action)
- FR24: System runs a polling fallback job for background checks pending longer than 24 hours
- FR25: Admin can view background check status and result summary for any provider
- FR26: Admin can initiate Checkr adverse action workflow when rejecting based on background check
- FR27: Admin can approve a provider with "consider" background check status (adjudication decision)
- FR28: System blocks provider from dispatch eligibility until background check status is "clear" or admin-approved "consider"

**5. Stripe Connect Express**
- FR29: Provider can initiate Stripe Connect Express onboarding from the onboarding dashboard
- FR30: Provider can return to the onboarding dashboard after completing Stripe's hosted flow with status automatically updated
- FR31: Provider can re-enter Stripe Connect flow if they abandoned it partway through
- FR32: System receives and processes Stripe account.updated webhooks to track Connect onboarding status
- FR33: System runs a polling fallback to check Stripe Connect account completion status
- FR34: System sends reminder notifications to providers who started but haven't completed Stripe Connect (at 24h and 72h)
- FR35: Provider can manage their bank account and tax info directly through Stripe's dashboard (no admin intermediary)

**6. Training & Policy Acknowledgment**
- FR36: Provider can view and complete training modules consisting of policy acknowledgment cards
- FR37: Provider can complete training incrementally with progress saved between sessions
- FR38: Each training card requires the provider to acknowledge they've read and understood the content
- FR39: System tracks which training cards have been acknowledged and which remain

**7. Admin Onboarding Pipeline**
- FR40: Admin can view all providers in the onboarding pipeline grouped by current stage
- FR41: Admin can filter and search providers by onboarding stage, name, or application date
- FR42: Admin can view a complete onboarding checklist for any provider showing all step statuses at a glance
- FR43: Admin can activate a provider after all onboarding steps are complete (final review)
- FR44: Admin can reject a provider at any point with a reason
- FR45: Admin receives real-time updates when providers complete onboarding steps or submit documents

**8. Existing Provider Migration**
- FR46: Existing provider can view a migration dashboard showing only the steps they need to complete (not the full onboarding flow)
- FR47: System determines which onboarding steps an existing provider has already satisfied and marks them complete. Satisfaction rules: linked user account → account creation satisfied; existing provider record with active status → application satisfied; no existing data satisfies background check, document uploads, training, or Stripe Connect — these must be completed during migration
- FR48: Existing provider retains full platform access during their 30-day grace period while completing migration
- FR49: System sends migration notifications at Day 0, Day 14, Day 25, and Day 30 via email, SMS, and push
- FR50: System automatically suspends providers who haven't completed migration by their deadline
- FR51: Suspended provider can complete remaining migration steps at any time to reactivate their account

**9. Payout Transition**
- FR52: System routes payouts through Stripe Connect for providers with a connected account
- FR53: System continues routing payouts through manual batch process for providers without a connected Stripe account
- FR54: System deprecates manual payout support 60 days after migration launch

**10. Notifications & Communication**
- FR55: Provider receives email, SMS, and push notification when their application is received
- FR56: Provider receives notification when any onboarding step status changes (document reviewed, background check complete, activation)
- FR57: Provider receives notification when admin action is required from them (re-upload, additional info)
- FR58: Admin receives notification when a provider is ready for final review (all steps complete)
- FR59: Admin receives notification when a new document is submitted for review

### NonFunctional Requirements

**Performance**
- NFR-P1: Onboarding dashboard initial load completes in < 1.5 seconds on 4G connection
- NFR-P2: Document photo preview renders within 500ms of capture
- NFR-P3: Presigned URL generation returns within 500ms
- NFR-P4: Client-side image compression completes in < 2 seconds for photos up to 10MB
- NFR-P5: Stripe Connect account link generation returns within 2 seconds
- NFR-P6: Real-time onboarding event delivery to connected clients within 500ms of server-side state change
- NFR-P7: Admin pipeline view loads < 2 seconds with up to 50 in-progress providers

**Security**
- NFR-S1: All document uploads stored with server-side encryption at rest
- NFR-S2: Presigned upload URLs expire within 15 minutes of generation
- NFR-S3: Presigned download URLs for admin document review expire within 10 minutes
- NFR-S4: FCRA consent recorded as immutable audit record (provider ID, timestamp, IP, consent version)
- NFR-S5: No PII stored beyond what's strictly necessary — Checkr stores full reports, Stripe stores financial data, platform stores only IDs and status
- NFR-S6: Checkr webhooks validated via cryptographic signature on every request; invalid signatures rejected with 401
- NFR-S7: Stripe Connect webhooks validated via Stripe signature (existing pattern)
- NFR-S8: Uploaded files validated server-side via file content inspection — reject non-image files regardless of extension
- NFR-S9: Provider document URLs never exposed to other providers or customers — scoped to admin and the owning provider
- NFR-S10: Background check status transitions logged to audit trail with actor, timestamp, and previous/new status

**Scalability**
- NFR-SC1: System supports 10 concurrent providers in onboarding pipeline without performance degradation
- NFR-SC2: System supports migration burst of up to 30 existing providers notified in the same week
- NFR-SC3: Checkr polling fallback job handles up to 50 pending checks per run without timeout
- NFR-SC4: Stripe Connect polling fallback handles up to 50 pending accounts per run
- NFR-SC5: Document storage scales linearly — estimated 5-8 documents per provider, ~2MB average per document

**Integration Reliability**
- NFR-I1: Checkr webhook processing achieves 99.9% successful delivery handling
- NFR-I2: Checkr polling fallback activates for any check pending > 24 hours; runs every 4 hours
- NFR-I3: Stripe Connect polling fallback activates for any account not updated via webhook within 4 hours of Stripe flow completion
- NFR-I4: All external API calls (Checkr, Stripe) include automatic retry with progressive delay (3 retries)
- NFR-I5: Webhook endpoints return 200 within 5 seconds to prevent external service retries
- NFR-I6: State reconciliation ensures zero orphaned provider states — every provider has a valid, actionable status at all times
- NFR-I7: External service outages (Checkr down, Stripe down) gracefully degrade — provider sees "temporarily unavailable, try again later" instead of errors

### Additional Requirements

**From Architecture — Data Architecture**
- Normalized `onboarding_steps` table with `draftData` JSONB column (hybrid) for step tracking
- Separate `provider_documents` table with review workflow lifecycle
- Extend existing `providerStatusEnum` with: applied, onboarding, pending_review, rejected, suspended
- New columns on providers table: stripeConnectAccountId, migrationBypassExpiresAt, activatedAt, suspendedAt, suspendedReason, previousApplicationId
- Create all 5 onboarding step rows on provider entering onboarding (no lazy initialization)

**From Architecture — Middleware & Security**
- `requireOnboardingComplete` middleware chained after `requireProvider` on dispatch-gated routes
- Migration bypass via `migrationBypassExpiresAt` timestamp column — hard database-level expiration, checked at request time against NOW()
- FCRA consent recorded ONLY via `logAudit()` — immutable audit record, never a provider column
- Background check data: only Checkr IDs stored in step metadata JSONB — never full report content
- Stripe Connect data: only `stripeConnectAccountId` on provider — never bank/SSN/tax data

**From Architecture — External Integrations**
- Checkr: direct REST via `fetch` with typed wrapper in `server/api/lib/checkr.ts` (no SDK dependency)
- Stripe Connect: use existing `stripe@20.3.0` package — Express account creation, onboarding links, transfers
- Payout routing: implicit via `stripeConnectAccountId` existence — no `payoutMode` column
- Webhook security: Checkr HMAC validation + Stripe signature validation in centralized `webhooks.ts`
- Polling fallback: reconciliation functions for Checkr (24h threshold) and Stripe Connect (4h threshold) in `server/api/lib/reconciliation.ts`

**From Architecture — Frontend**
- Mobile-first card-per-step onboarding dashboard layout
- Camera capture via `accept="image/*" capture="environment"` on file inputs
- Client-side image compression before upload (target < 2MB)
- Stripe Connect opens in new tab via `window.open()` — return URL detection on redirect back
- WebSocket subscription on dashboard mount for real-time step status updates
- Admin pipeline view: providers grouped by stage, click-through to detail with document review
- All onboarding components in `components/onboarding/` folder (distinct lifecycle domain)

**From Architecture — Implementation Sequence**
- Dependency-ordered: schema → middleware → dashboard skeleton → admin pipeline → Checkr → Stripe Connect → documents → training → migration
- Checkr and Stripe Connect integrations can be parallelized
- Training module is independent, can parallel with integrations
- Migration flow depends on all prior work

**From PRD — Domain/Compliance**
- FCRA: explicit consent before background check, Checkr handles adverse action notices, platform stores only status + IDs
- Stripe Connect: Stripe handles all identity/bank/tax verification, platform never stores sensitive financial data, 1099-K handled by Stripe
- Georgia towing regulations: tow operator license verified as certifications upload step
- Insurance: commercial auto required, personal auto explicitly rejected, admin review with coverage thresholds
- Data retention: active docs retained while active, deactivated docs 1 year, background check metadata indefinitely

**From PRD — Browser Support & Accessibility**
- Browser support: Chrome 90+, Safari 15+, Firefox 90+, Edge 90+, iOS Safari 15+
- Accessibility: WCAG 2.1 AA via shadcn/ui defaults
- Responsive: fully functional at 375px width (iPhone SE minimum)

### FR Coverage Map

- FR1: Epic 1 — Provider application form (personal info, contact, service area, specialties)
- FR2: Epic 1 — Account creation during application (email + password)
- FR3: Epic 1 — Invite link acceptance with pre-filled email
- FR4: Epic 1 — FCRA consent checkbox with timestamp
- FR5: Epic 1 — Auto-initiate background check on application submit
- FR6: Epic 1 — Unified pipeline for invited and self-registered providers
- FR7: Epic 1 — Onboarding dashboard with all steps and statuses
- FR8: Epic 1 — Flexible-order step completion
- FR9: Epic 1 — Cross-device progress persistence
- FR10: Epic 1 — Real-time dashboard updates via WebSocket
- FR11: Epic 1 — Onboarding state machine (applied → onboarding → pending_review → active / rejected / suspended)
- FR12: Epic 1 — Portal gate (requireOnboardingComplete middleware)
- FR13: Epic 2 — Mobile camera capture for document upload
- FR14: Epic 2 — Photo preview with retake/submit choice
- FR15: Epic 2 — Document-type-specific guidance before capture
- FR16: Epic 2 — Per-document independent status tracking
- FR17: Epic 2 — Re-upload after rejection with reason visible
- FR18: Epic 2 — Automatic upload retry on failure
- FR19: Epic 2 — Admin document view with zoom
- FR20: Epic 2 — Admin approve/reject with required reason
- FR21: Epic 2 — Provider notification on document review result
- FR22: Epic 3 — Create Checkr candidate and initiate criminal + MVR check
- FR23: Epic 3 — Process Checkr webhook status updates
- FR24: Epic 3 — Polling fallback for checks pending > 24 hours
- FR25: Epic 3 — Admin view background check status and summary
- FR26: Epic 3 — Admin initiate Checkr adverse action
- FR27: Epic 3 — Admin approve provider with "consider" status (adjudication)
- FR28: Epic 3 — Dispatch gate until background check cleared
- FR29: Epic 4 — Initiate Stripe Connect Express from dashboard
- FR30: Epic 4 — Return to dashboard after Stripe flow with auto-status update
- FR31: Epic 4 — Re-enter Stripe Connect if abandoned
- FR32: Epic 4 — Process Stripe account.updated webhooks
- FR33: Epic 4 — Polling fallback for Stripe Connect status
- FR34: Epic 4 — Reminder notifications for incomplete Stripe Connect (24h, 72h)
- FR35: Epic 4 — Provider self-manages bank/tax info via Stripe dashboard
- FR36: Epic 5 — View and complete policy acknowledgment training cards
- FR37: Epic 5 — Incremental training progress saved between sessions
- FR38: Epic 5 — Per-card acknowledgment required
- FR39: Epic 5 — Track acknowledged vs. remaining training cards
- FR40: Epic 6 — Admin pipeline view grouped by onboarding stage
- FR41: Epic 6 — Filter and search by stage, name, or application date
- FR42: Epic 6 — Complete onboarding checklist view per provider
- FR43: Epic 6 — Admin activate provider (final review)
- FR44: Epic 6 — Admin reject provider with reason
- FR45: Epic 6 — Admin real-time updates on provider progress
- FR46: Epic 7 — Migration dashboard showing only missing steps
- FR47: Epic 7 — Auto-determine satisfied steps for existing providers
- FR48: Epic 7 — Full platform access during 30-day grace period
- FR49: Epic 7 — Migration notifications at Day 0, 14, 25, 30
- FR50: Epic 7 — Auto-suspend on missed deadline
- FR51: Epic 7 — Reactivation by completing remaining steps
- FR52: Epic 4 — Route payouts via Stripe Connect for connected providers
- FR53: Epic 4 — Manual batch fallback for non-connected providers
- FR54: Epic 4 — Deprecate manual payouts 60 days post-migration
- FR55: Epic 8 — Application received notification (email, SMS, push)
- FR56: Epic 8 — Step status change notification
- FR57: Epic 8 — Action required notification (re-upload, additional info)
- FR58: Epic 8 — Admin notification: provider ready for final review
- FR59: Epic 8 — Admin notification: new document submitted

## Epic List

### Epic 1: Provider Application & Onboarding Foundation
Providers can apply to join the platform, create accounts (via self-registration or invite), and see a complete onboarding dashboard with real-time progress tracking. System enforces onboarding completion before dispatch.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12

### Epic 2: Document Upload & Compliance Review
Providers can upload insurance and certification documents using mobile camera capture, preview before submitting, track per-document status, and re-upload after rejection. Admin can view uploaded documents with zoom, and approve or reject with reasons.
**FRs covered:** FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21

### Epic 3: Background Check (Checkr Integration)
System automatically initiates background checks on provider consent, processes results via webhooks and polling fallback, and blocks dispatch until cleared. Admin can view results, adjudicate "consider" status, and initiate adverse action.
**FRs covered:** FR22, FR23, FR24, FR25, FR26, FR27, FR28

### Epic 4: Stripe Connect Express & Automated Payouts
Providers can set up Stripe Connect Express for automated payouts, return seamlessly after completing Stripe's hosted flow, and re-enter if abandoned. System routes payouts through Stripe Connect when available, falls back to manual batch, and deprecates manual payouts after 60 days.
**FRs covered:** FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR52, FR53, FR54

### Epic 5: Training & Policy Acknowledgment
Providers can view and complete training modules consisting of policy acknowledgment cards. Progress is saved incrementally between sessions, and the system tracks which cards have been acknowledged.
**FRs covered:** FR36, FR37, FR38, FR39

### Epic 6: Admin Onboarding Pipeline Management
Admin can view all in-progress providers grouped by onboarding stage, filter/search by stage or name, view complete checklists, activate or reject providers, and receive real-time updates as providers progress.
**FRs covered:** FR40, FR41, FR42, FR43, FR44, FR45

### Epic 7: Existing Provider Migration
Existing active providers see a streamlined migration dashboard showing only missing steps, retain full platform access during a 30-day grace period, receive notifications at Day 0/14/25/30, and are suspended if they miss the deadline. Suspended providers can complete migration at any time to reactivate.
**FRs covered:** FR46, FR47, FR48, FR49, FR50, FR51

### Epic 8: Onboarding Notifications & Communication
Providers receive notifications (email, SMS, push) when their application is received, when step statuses change, and when admin action is required. Admin receives notifications when providers are ready for review or submit documents.
**FRs covered:** FR55, FR56, FR57, FR58, FR59

---

## Mobile Mechanics + Beta + Mobile Parity (PRD: `prd-mobile-mechanics-beta.md`)

### Requirements Inventory

**FR-1: Mechanics Service Category**
- FR-1.1: Add `"mechanics"` to `service_category` PostgreSQL enum
- FR-1.2: Add `schedulingMode` column to `services` table (`"immediate"` / `"scheduled"` / `"both"`)
- FR-1.3: Seed 6 mechanic services with `schedulingMode = "scheduled"`
- FR-1.4: `POST /api/bookings` returns 400 if `scheduledAt` missing for scheduled-only services
- FR-1.5: `GET /api/services` accepts `?category=` query parameter
- FR-1.6: `GET /api/services` response includes `schedulingMode` field
- FR-1.7: `GET /api/services/categories` endpoint returns categories with counts
- FR-1.8: Each mechanic service has `checklistConfig` JSONB with service-specific items

**FR-2: Beta Mode**
- FR-2.1: Beta config stored in `platform_settings`: `beta_mode_active`, `beta_start_date`, `beta_end_date`
- FR-2.2: `server/api/lib/beta.ts` exports `isBetaActive()` helper
- FR-2.3: `getAllowedPaymentMethods()` returns all methods when beta active
- FR-2.4: New `beta_users` table: `id`, `userId`, `enrolledAt`, `source`, `convertedAt`
- FR-2.5: Auto-enroll user in `beta_users` on any booking during beta
- FR-2.6: `GET /api/beta/status` returns beta state and enrollment
- FR-2.7: Admin can toggle `beta_mode_active` via settings UI
- FR-2.8: Admin dashboard shows beta user count and mechanic stats

**FR-3: Mechanic Dispatch (Cron-Based)**
- FR-3.1: Cron runs every 15 min checking mechanic bookings with `scheduledAt` within 2 hours
- FR-3.2: Cron triggers `autoDispatchBooking()` for eligible bookings
- FR-3.3: Dispatch matches providers with `"mechanics"` in specialties
- FR-3.4: Failed dispatch notifies admin

**FR-4: Observation → Mechanic Upsell**
- FR-4.1: Match medium/high severity observation category to mechanic service slug
- FR-4.2: Follow-up SMS/email includes deep link to booking with service pre-selected
- FR-4.3: Deep link includes `serviceId` and `vehicleInfo` from original booking

**FR-5: Push Notifications (Mobile)**
- FR-5.1: `POST /api/push/register-device` stores Expo push token
- FR-5.2: `DELETE /api/push/unregister-device` removes token
- FR-5.3: Notification dispatch sends via Expo Push API for mobile, web-push for browser
- FR-5.4: Push on: booking created, provider dispatched, arrived, completed, cancelled
- FR-5.5: Push to provider on: job assigned, job cancelled

**FR-6: Mobile App Parity**
- FR-6.1: Services screen shows category tabs: Roadside / Diagnostics / Mechanics
- FR-6.2: Booking flow enforces date picker for mechanic services
- FR-6.3: Provider accept/reject jobs with full details
- FR-6.4: Provider status updates through lifecycle
- FR-6.5: Provider GPS tracking (30s intervals)
- FR-6.6: Customer real-time tracking map
- FR-6.7: Provider observation form with photo capture
- FR-6.8: Provider inspection report form
- FR-6.9: Referral sharing via native Share API
- FR-6.10: Referral credit balance display
- FR-6.11: Review submission after completed booking
- FR-6.12: Push notification permission request on first launch
- FR-6.13: Notification tap navigates to relevant booking detail

### Epic List (Continued)

### Epic 16: Mechanics Service Category + Beta Foundation
Add the `mechanics` service category with 6 scheduled-only services, beta mode config via `platform_settings`, trust tier bypass during beta, and beta user tracking. This is the schema + data + config foundation that everything else builds on.
**FRs covered:** FR-1.1, FR-1.2, FR-1.3, FR-1.5, FR-1.6, FR-1.7, FR-1.8, FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-2.5, FR-2.6, FR-2.7
**Sprint:** 1 (Apr 7–20)
**Dependencies:** None — foundational

#### Stories

**Story 16.1: Extend service_category enum and add schedulingMode column**
- Add `"mechanics"` to `serviceCategoryEnum` in `db/schema/services.ts`
- Add `schedulingMode` text column (default `"both"`) to services table
- Generate and run Drizzle migration
- Export from `db/schema/index.ts`
- **Acceptance:** `npm run db:generate` succeeds, migration applies cleanly, existing services unaffected
- **Files:** `db/schema/services.ts`, `db/schema/index.ts`

**Story 16.2: Create beta_users table**
- Create `db/schema/beta-users.ts` with `id`, `userId`, `enrolledAt`, `source`, `convertedAt`
- Add unique constraint on `userId` for idempotent enrollment
- Export from `db/schema/index.ts`
- Generate and run migration
- **Acceptance:** Table created, insert + `onConflictDoNothing` works
- **Files:** `db/schema/beta-users.ts`, `db/schema/index.ts`

**Story 16.3: Seed mechanic services and beta config**
- Add 6 mechanic services to `db/seed.ts` (oil-change, brake-service, battery-replace, general-maintenance, ac-repair, belt-replacement) all with `category: "mechanics"`, `schedulingMode: "scheduled"`
- Add `checklistConfig` JSONB for each service
- Insert `platform_settings` rows: `beta_mode_active=true`, `beta_start_date=2026-04-07`, `beta_end_date=2026-06-07`
- **Acceptance:** `GET /api/services` returns 12 services (6 existing + 6 new), all mechanics services have `schedulingMode: "scheduled"`
- **Files:** `db/seed.ts`

**Story 16.4: Create beta helper and trust tier bypass**
- Create `server/api/lib/beta.ts` with `isBetaActive()` (60s cache)
- Modify `getAllowedPaymentMethods()` in `server/api/lib/trust-tier.ts` to return tier 2 methods when beta active
- Add audit log entry `beta_trust_bypass` when bypass triggers
- **Acceptance:** During beta, tier 1 users see all payment methods. After setting `beta_mode_active=false`, tier 1 users see only cash/cashapp/zelle
- **Files:** `server/api/lib/beta.ts` (new), `server/api/lib/trust-tier.ts`

**Story 16.5: Add category filter to services API**
- Add `?category=` query param to `GET /api/services` in `server/api/routes/services.ts`
- Include `schedulingMode` in response
- Add `GET /api/services/categories` returning `[{ category, count }]`
- **Acceptance:** `GET /api/services?category=mechanics` returns only mechanic services
- **Files:** `server/api/routes/services.ts`

**Story 16.6: Beta status endpoint and auto-enrollment**
- Add `GET /api/beta/status` returning `{ active, startDate, endDate, enrolled }`
- Modify `POST /api/bookings` to auto-enroll user in `beta_users` during beta (fire-and-forget, `onConflictDoNothing`)
- **Acceptance:** Booking during beta creates beta_users row; `GET /api/beta/status` shows enrolled
- **Files:** `server/api/routes/bookings.ts`, new route or add to existing

**Story 16.7: Admin beta toggle**
- Add beta mode toggle to admin business settings UI
- Show beta user count and mechanic booking count on admin dashboard
- **Acceptance:** Admin can flip beta on/off; dashboard shows beta stats
- **Files:** Admin settings component, admin dashboard component

---

### Epic 17: Mechanic Booking + Dispatch
Mechanic booking flow enforces scheduled-only booking, and a cron-based pre-dispatch fires 2 hours before appointment time. Includes observation → mechanic upsell pipeline.
**FRs covered:** FR-1.4, FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-4.1, FR-4.2, FR-4.3
**Sprint:** 2 (Apr 21 – May 4)
**Dependencies:** Epic 16 (schema + services + beta)

#### Stories

**Story 17.1: Enforce scheduledAt for mechanic bookings**
- In `POST /api/bookings`, fetch service and check `schedulingMode`
- If `schedulingMode === "scheduled"` and `scheduledAt` is null → return 400: "Mechanic services require a scheduled date"
- If `scheduledAt` is in the past → return 400
- **Acceptance:** Booking oil-change without scheduledAt returns 400; with valid future date succeeds
- **Files:** `server/api/routes/bookings.ts`

**Story 17.2: Mechanic pre-dispatch cron job**
- Add cron to `server/cron.ts`: every 15 minutes, query confirmed mechanic bookings with `scheduledAt` within 2 hours and no provider assigned
- Call existing `autoDispatchBooking()` for each match
- Log dispatch attempts and failures
- **Acceptance:** Mechanic booking confirmed for 10:00 AM gets dispatched between 8:00–8:15 AM; running cron twice doesn't double-dispatch
- **Files:** `server/cron.ts`

**Story 17.3: Observation → mechanic upsell**
- Create `server/api/lib/observation-upsell.ts` with hardcoded category-to-service slug map
- In `POST /api/observations`, after saving medium/high severity items, generate deep link to booking with matching mechanic service pre-selected
- Include deep link in follow-up SMS/email notification
- **Acceptance:** Provider logs "Brakes — medium" observation → customer receives SMS with link to brake-service booking
- **Files:** `server/api/lib/observation-upsell.ts` (new), `server/api/routes/observations.ts`

**Story 17.4: Web mechanic booking UI**
- Update booking form to show mechanic services with "Scheduled Service" badge
- Hide "ASAP" toggle when mechanic service selected
- Show date/time picker (required) for mechanic bookings
- **Acceptance:** Selecting "Oil Change" forces date picker, hides ASAP option
- **Files:** `components/booking/booking-form.tsx`

---

### Epic 18: Push Notifications + Mobile Parity (Provider)
Expo push notification infrastructure. Provider mobile features: job management, GPS tracking, observations, inspection reports.
**FRs covered:** FR-5.1, FR-5.2, FR-5.3, FR-5.4, FR-5.5, FR-6.3, FR-6.4, FR-6.5, FR-6.7, FR-6.8, FR-6.12
**Sprint:** 2–3 (Apr 21 – May 18)
**Dependencies:** Epic 16 (schema), Epic 17 (booking flow)

#### Stories

**Story 18.1: Device token table and registration endpoints**
- Create `db/schema/device-tokens.ts` with `id`, `userId`, `expoPushToken`, `platform`, timestamps
- Add `POST /api/push/register-device` and `DELETE /api/push/unregister-device`
- Validate Expo token format on registration
- **Acceptance:** Mobile app registers token on login; token stored in DB; unregister removes it
- **Files:** `db/schema/device-tokens.ts` (new), `server/api/routes/push.ts`

**Story 18.2: Dual-channel push notification dispatch**
- Extend `lib/notifications/push.ts` to query both `push_subscriptions` (web) and `device_tokens` (mobile)
- For mobile tokens: send via Expo Push API (`https://exp.host/--/api/v2/push/send`)
- Fire-and-forget with error logging
- **Acceptance:** Status change on booking triggers push to both web (if subscribed) and mobile (if token registered)
- **Files:** `lib/notifications/push.ts`

**Story 18.3: Mobile push notification setup (Expo)**
- Create `src/lib/push.ts` in mobile repo — `expo-notifications` setup, permission request, token registration
- Register token with backend on login, unregister on logout
- Handle notification tap → navigate to booking detail screen
- **Acceptance:** App requests permission on first launch; receiving push while app backgrounded shows notification; tapping navigates to booking
- **Files:** Mobile: `src/lib/push.ts` (new)

**Story 18.4: Provider job management (mobile)**
- Ensure provider dashboard shows assigned jobs with full details
- Accept/reject buttons functional with API hooks
- Status update flow: en_route → arrived → in_progress → completed
- **Acceptance:** Provider can accept a mechanic job and update through all statuses from mobile
- **Files:** Mobile: `src/features/provider/dashboard-screen.tsx`, `src/features/provider/api.ts`

**Story 18.5: Provider GPS tracking (mobile)**
- Implement 30-second GPS update posting to `POST /api/provider/location`
- Toggle tracking on/off with availability status
- **Acceptance:** Provider location updates visible in admin dashboard and customer tracking map
- **Files:** Mobile: `src/features/provider/dashboard-screen.tsx` or new component

**Story 18.6: Provider observations (mobile)**
- Create `src/features/provider/observations-screen.tsx`
- Checklist-based form with category, description, severity, photo capture via `expo-image-picker`
- POST to `/api/observations`
- Add React Query hooks to `src/features/provider/api.ts`
- **Acceptance:** Provider submits observation with photo from mobile; observation visible in admin
- **Files:** Mobile: `src/features/provider/observations-screen.tsx` (new), `api.ts`

**Story 18.7: Provider inspection reports (mobile)**
- Create `src/features/provider/inspection-report-screen.tsx`
- Structured findings form: category, component, condition, description, OBD code, photo
- POST to `/api/inspection-reports`
- **Acceptance:** Provider submits inspection report from mobile; PDF generation triggers
- **Files:** Mobile: `src/features/provider/inspection-report-screen.tsx` (new), `api.ts`

---

### Epic 19: Mobile Parity (Customer) + Polish
Customer-facing mobile features: service categories, mechanic booking flow, real-time tracking, referrals, reviews. Beta analytics in admin. Bug fixes.
**FRs covered:** FR-6.1, FR-6.2, FR-6.6, FR-6.9, FR-6.10, FR-6.11, FR-6.13, FR-2.8
**Sprint:** 3–4 (May 5 – Jun 7)
**Dependencies:** Epic 16, 17, 18

#### Stories

**Story 19.1: Service category tabs (mobile)**
- Update services screen to show Roadside / Diagnostics / Mechanics tabs
- Use `GET /api/services?category=` for filtered fetching
- Mechanic services show "Scheduled" badge
- **Acceptance:** Three tabs visible; selecting Mechanics shows only mechanic services
- **Files:** Mobile: `src/features/services/services-screen.tsx`

**Story 19.2: Mechanic booking flow (mobile)**
- Update booking flow to enforce date/time picker when mechanic service selected
- Hide "ASAP" option for mechanic services
- Show location as "Where should the mechanic come?"
- **Acceptance:** Booking oil change on mobile requires date selection; booking submits successfully
- **Files:** Mobile: `src/app/book.tsx`, `src/features/bookings/api.ts`

**Story 19.3: Real-time tracking map (mobile)**
- Create tracking map component using `react-native-maps`
- Show provider location marker with updates (poll `/api/provider/location` or WebSocket)
- Accessible from booking detail when status is `dispatched` or `in_progress`
- **Acceptance:** Customer sees provider moving on map during active service
- **Files:** Mobile: new `src/components/tracking-map.tsx`, booking detail screen

**Story 19.4: Referral system (mobile)**
- Create `src/features/referrals/` with screen and `api.ts`
- Show referral code, share via `Share.share()`, display credit balance
- Hook into `GET /api/referrals/me` and `GET /api/referrals/me/balance`
- **Acceptance:** User can share referral code via native share sheet; balance displays correctly
- **Files:** Mobile: `src/features/referrals/referrals-screen.tsx` (new), `api.ts` (new)

**Story 19.5: Reviews end-to-end verification (mobile)**
- Verify existing `src/app/review.tsx` works with current API
- Fix any broken hooks or navigation
- Ensure review prompt appears after booking completion
- **Acceptance:** Customer can submit star rating + comment after service from mobile
- **Files:** Mobile: `src/app/review.tsx`, `src/features/bookings/api.ts`

**Story 19.6: Beta analytics dashboard (admin)**
- Add beta section to admin dashboard: total beta users, mechanic bookings count, conversion funnel
- Show mechanic service breakdown (bookings per service type)
- **Acceptance:** Admin sees beta stats; counts match `beta_users` and mechanic bookings tables
- **Files:** Admin dashboard components

**Story 19.7: Bug fixes and performance (all)**
- Address issues surfaced during beta testing
- Performance optimization based on real usage patterns
- Mobile app crash fixes, API edge cases
- **Acceptance:** No P0 bugs open; app crash rate <1%
- **Files:** Various

---

## Cross-Initiative Dependency Map

```
Epic 16 (Foundation)
  ├── Epic 17 (Booking + Dispatch) ── depends on schema + services
  ├── Epic 18 (Push + Provider Mobile) ── depends on schema + device tokens
  │     └── Epic 19 (Customer Mobile + Polish) ── depends on push + provider features
  └── Epic 19 also depends on Epic 16 directly (categories, beta config)
```

## FR Coverage Matrix (Mobile Mechanics + Beta)

| FR Group | Epic 16 | Epic 17 | Epic 18 | Epic 19 | Covered |
|---|---|---|---|---|---|
| FR-1 (Mechanics) | 1.1–1.3, 1.5–1.8 | 1.4 | | | 8/8 |
| FR-2 (Beta) | 2.1–2.7 | | | 2.8 | 8/8 |
| FR-3 (Dispatch) | | 3.1–3.4 | | | 4/4 |
| FR-4 (Upsell) | | 4.1–4.3 | | | 3/3 |
| FR-5 (Push) | | | 5.1–5.5 | | 5/5 |
| FR-6 (Mobile) | | | 6.3–6.5, 6.7–6.8, 6.12 | 6.1–6.2, 6.6, 6.9–6.11, 6.13 | 13/13 |
| **Total** | | | | | **41/41** |

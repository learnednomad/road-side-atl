---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics']
inputDocuments:
  - _bmad-output/planning-artifacts/prd-provider-onboarding.md
  - _bmad-output/planning-artifacts/architecture.md
---

# road-side-atl - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for road-side-atl, decomposing the requirements from the PRD (Provider Onboarding) and Architecture into implementable stories.

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

---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
completedAt: '2026-03-02'
lastEdited: '2026-03-02'
editHistory:
  - date: '2026-03-02'
    changes: 'Post-validation fixes: removed FR/NFR implementation leakage (9 items), added browser support + WCAG target, strengthened FR47 migration rules, added FR cross-refs to Journey Summary, added How Measured column to Success Criteria, renamed Implementation Considerations to Implementation Guidance'
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-road-side-atl-2026-02-11.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/project-context.md
  - docs/index.md
  - docs/architecture.md
  - docs/data-models.md
  - docs/api-contracts.md
  - docs/project-context.md
workflowType: 'prd'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 5
  projectContext: 2
  existingPRD: 1
classification:
  projectType: Web App — Brownfield Feature Expansion
  domain: On-Demand Services / Gig Marketplace
  complexity: Medium-High
  projectContext: Brownfield — Feature Expansion
onboardingPipeline:
  - Application (enhanced self-registration)
  - Background check (Checkr — MVR + criminal, hard gate)
  - Insurance verification (upload + admin review)
  - Certifications (upload + admin review)
  - Vehicle/equipment documentation (upload + admin review)
  - Training acknowledgment (checkbox flow)
  - Stripe Connect Express setup (identity + bank + tax)
  - Admin final review → activation
onboardingRules:
  stepOrder: flexible (any order)
  allRequiredForActivation: true
  backgroundCheckGate: hard (blocks dispatch)
  trainingType: checkbox acknowledgment
  documentReview: manual admin review
---

# Product Requirements Document - Provider Onboarding

**Author:** Beel
**Date:** 2026-03-01

## Executive Summary

**Vision:** Transform RoadSide ATL's provider acquisition from manual invite-only to a self-serve, compliance-first onboarding pipeline that vets providers (background checks, insurance, certifications), automates payouts via Stripe Connect, and scales provider supply to meet Atlanta-metro demand.

**Target Users:**
- **Providers** — Independent tow operators and mobile mechanics joining the platform (new applicants + existing providers migrating)
- **Admin (Beel)** — Operations manager reviewing documents, adjudicating background checks, and activating providers

**Differentiator:** Flexible-order onboarding (providers complete steps in any sequence), mobile-first document capture (camera-to-upload in seconds), and real-time progress tracking via WebSocket — designed for providers who are between jobs on their phone, not sitting at a desktop.

**Scope:** Brownfield feature expansion on the existing Next.js 16 / Hono / Drizzle platform. Introduces Checkr (background checks), Stripe Connect Express (automated payouts), and S3 document uploads. No new frameworks.

## Success Criteria

### User Success (Providers)

| Criteria | Target | Rationale | How Measured |
|---|---|---|---|
| Self-serve step completion rate | **> 90%** | Measures everything the provider controls (uploads, training, Stripe setup). High bar because flexible ordering removes sequencing friction. | Onboarding progress DB: providers who complete all self-serve steps / total applicants |
| End-to-end activation rate | **> 80%** | Application → fully dispatchable, including Checkr turnaround and admin review. Separating from self-serve rate reveals whether drop-off is UX or pipeline. | Provider status transitions: `applied` → `active` / total `applied` |
| Time-to-activation (application → dispatchable) | **< 3 business days** | Checkr basic + MVR runs 1-3 days. Admin doc review same-day at ~10 concurrent. Provider-side steps completable in < 1 hour. | Timestamp delta: `createdAt` (application) → status set to `active` |
| Onboarding progress clarity | **100% of providers can see remaining steps** | Dashboard showing completed/pending/blocked steps with clear next-action guidance. | Manual UX audit: dashboard renders all steps with status for every provider |
| Time-to-first-action | **< 30 seconds** | From landing on onboarding dashboard to starting first step. Providers are mobile-first, between jobs — no friction tolerance. | Session analytics: dashboard load → first step interaction |
| Stripe Connect setup completion | **> 90% of providers who reach this step** | Stripe Express is lightweight. Drop-off here means UX failure on the handoff, not complexity. | Stripe Connect status: `charges_enabled` / providers who generated onboarding link |
| Stripe return rate | **> 85%** | Track providers who click "Set up payouts" and actually complete Stripe's hosted flow and return. | Return URL hits / onboarding link generations |
| Mobile completion rate parity | **Within 5% of desktop** | Providers are tow operators and mechanics — phone is primary device. If mobile lags desktop, upload/form UX is broken. | Completion rate segmented by user-agent (mobile vs. desktop) |
| First job within 7 days of activation | **> 70%** | If activated providers aren't dispatched within a week, coverage areas don't match demand or provider went cold. | Booking records: first booking with `providerId` within 7 days of activation date |

### Business Success

| Criteria | Target | Rationale | How Measured |
|---|---|---|---|
| Provider acquisition cost | **< $50/activated provider** | Includes ~$40 Checkr cost + ~$7.50 admin review time (15 min at imputed $30/hr). Leaves minimal room for paid acquisition — organic + referral driven. | (Checkr cost + admin time imputed cost) / activated providers per month |
| Manual payout elimination | **100% of payouts via Stripe Connect** | Current batch process doesn't scale. Every activated provider must have a connected Stripe Express account. | Payout records: Stripe Connect payouts / total payouts |
| Background check pass rate | **> 88%** | Atlanta-metro tow/mechanic workforce typically passes at 88-92%. Below 88% signals a sourcing problem, not check calibration. | Checkr results: `clear` + admin-approved `consider` / total checks completed |
| Admin review turnaround | **< 24 hours** for doc review | At 10 concurrent providers, admin should clear the review queue daily. | Timestamp delta: document `uploadedAt` → admin `reviewedAt` |
| Provider quality (post-onboarding) | **Average rating > 4.2 within first 10 jobs** | Vetting pipeline should produce higher-quality providers than the current invite-only flow. | Reviews table: average rating for providers with ≤ 10 completed bookings |
| Time-to-first-payout | **< 3 business days** after first completed job | The moment a provider gets paid automatically is the moment they trust the platform. Critical for retention. | Stripe Connect transfer timestamp − booking `completedAt` timestamp |

### Technical Success

| Criteria | Target | Rationale | How Measured |
|---|---|---|---|
| Checkr webhook reliability | **99.9% delivery** | Failed webhooks mean providers stuck in limbo. | Webhook endpoint success rate: 200 responses / total webhook requests received |
| State reconciliation coverage | **100%** | Every external integration (Checkr, Stripe Connect) has both webhook-driven AND polling-based fallback for status updates. No provider stuck due to missed webhook. | Weekly reconciliation job: providers with stale pending status > 28 hours = 0 |
| Stripe Connect onboarding success | **< 5% error rate** | Express onboarding is Stripe-hosted — errors mostly on their side, but we need graceful handling and retry UX. | Stripe Connect errors logged / total onboarding link generations |
| Onboarding state consistency | **Zero orphaned states** | No provider in an unrecoverable state. Every status transition auditable via audit logger. | Reconciliation query: providers with invalid status combinations = 0 |
| Document upload reliability | **< 2% upload failures** | Presigned URL uploads matching existing platform pattern. | Upload error logs / total upload attempts |

### Measurable Outcomes

| Timeframe | Outcome |
|---|---|
| Month 1 | 10 providers fully onboarded through new pipeline. Admin confirms < 15 min review time per provider. |
| Month 3 | Stripe Connect payouts fully replace manual batch process. Zero manual payouts remaining. |
| Month 6 | Onboarding funnel optimized based on drop-off data. Self-serve completion > 90%, end-to-end > 80%. |
| Month 12 | Background re-check automation in place. Insurance expiration tracking active. Provider churn < 15%/year. |

## Product Scope

### MVP — Minimum Viable Product

Full provider pipeline from application to first dispatched job: Checkr background checks, document uploads with admin review, training acknowledgment, Stripe Connect Express payouts, onboarding dashboard, admin pipeline view, and existing provider migration. See [MVP Feature Set (Phase 1)](#mvp-feature-set-phase-1) for detailed breakdown.

### Growth Features (Post-MVP)

- Automated insurance verification (carrier database lookup)
- Provider referral bonuses (existing providers recruit new ones)
- Tiered onboarding (lighter requirements for diagnostic-only providers vs. towing)
- Onboarding analytics dashboard (funnel conversion, drop-off points, avg completion time)
- Bulk admin review tools (batch approve/reject when volume exceeds ~20 concurrent)

### Vision (Future)

- AI-assisted document review (auto-extract insurance policy details, expiration dates)
- Automated re-verification (insurance renewal tracking, annual background re-check)
- Provider skill assessments (in-app skill verification beyond checkbox training)
- Multi-market onboarding (different requirements per city/state as RoadSide expands beyond ATL)

## User Journeys

### Journey 1: Marcus — The Independent Tow Operator (Happy Path)

Marcus runs a one-truck towing operation out of East Atlanta. He's been doing roadside work for 6 years — mostly through word-of-mouth and a few dealership relationships. He heard about RoadSide ATL from another operator at a gas station who said "the app pays better than AAA subcontracting and you get jobs pushed to your phone."

**Opening Scene:** Marcus finds the RoadSide ATL website on his phone during downtime between calls. He taps "Become a Provider" and fills out the application — name, email, phone, service area, specialties (towing, jump starts, lockouts). Takes 3 minutes. He gets a confirmation email: "Application received. Complete your onboarding to start getting jobs."

**Rising Action:** Marcus logs in and sees his onboarding dashboard — a clean checklist with 7 remaining steps, each showing an icon and estimated time. He knocks out three while waiting for his next tow call:
- Uploads his commercial auto insurance declaration page (photo from his phone, 30 seconds)
- Uploads his Georgia tow operator license (another photo)
- Scrolls through the platform safety and dispatch policies, checks the acknowledgment boxes

The next day, he gets a notification: "Insurance verified — approved by admin." He clicks into Stripe Connect, enters his bank info and SSN last 4 on Stripe's hosted page, and is back in the app in 2 minutes. His background check (initiated when he applied) clears that afternoon — he gets a push notification.

**Climax:** One remaining item: admin final review. Marcus sees "Pending Review" status. That evening, the admin approves him. His dashboard flips to "You're Active!" with a prompt to toggle his availability on.

**Resolution:** Marcus turns on availability at 7am the next morning. By 9:15am, his phone buzzes — first job, a jump start 4 miles away. He accepts, arrives in 11 minutes, gets the car running, and sees the payout hit his Stripe dashboard by end of day. He texts the operator who told him about the app: "This thing is legit."

**Requirements revealed:** Application form, onboarding dashboard with progress tracker, document upload (mobile-optimized photos), Checkr background check (auto-initiate), Stripe Connect Express handoff, admin review workflow, status notifications (email + push), availability toggle post-activation, automated payout.

---

### Journey 2: Keisha — The Mobile Mechanic (Edge Cases)

Keisha is a certified ASE mechanic who runs a mobile diagnostic service from her van. She's been doing pre-purchase inspections for used car buyers off Facebook Marketplace. She finds RoadSide ATL through a Google search for "mobile mechanic jobs Atlanta."

**Opening Scene:** Keisha applies and starts her onboarding. She uploads her personal auto policy (wrong document type) and starts the training acknowledgment but her phone dies halfway through.

**Rising Action:** The admin reviews her insurance upload and rejects it with a note: "Commercial auto insurance required for provider operations. Personal auto policies don't cover commercial roadside work." Keisha gets an email with the rejection reason and a clear explanation of what's needed. She calls her insurance agent, gets the right document, and re-uploads.

Meanwhile, her training progress was saved — she picks up where she left off. But her Checkr background check flags a 7-year-old misdemeanor. Checkr's adjudication process kicks in — Keisha gets an email from Checkr to provide context. She responds, Checkr clears it as "consider" status.

**Climax:** The admin sees Keisha's background check came back as "consider" (not "clear"). The admin reviews the details — minor, non-violent, 7 years ago — and approves her based on the platform's adjudication policy. All other steps are green.

**Resolution:** Keisha gets activated. She specializes in diagnostics, so she gets her first scheduled inspection booking within a few days. The structured onboarding gave her confidence in the platform — "if they're this thorough about vetting me, they're probably thorough about getting me paid too."

**Requirements revealed:** Document rejection with reason + re-upload flow, partial progress saving (training), Checkr adjudication handling ("consider" status), admin adjudication decision UI, commercial insurance guidance documentation, re-upload notifications.

---

### Journey 3: Admin Davon — Managing the Pipeline

Davon is the operations manager for RoadSide ATL. He spends part of his morning managing the provider onboarding pipeline.

**Opening Scene:** Davon logs into the admin panel and navigates to the Provider Onboarding section. He sees a pipeline view: 3 providers in "Documents Pending Review", 2 in "Awaiting Background Check", 1 in "Ready for Final Review", and 8 active providers already on the platform.

**Rising Action:** He clicks into the review queue. First up: Marcus's insurance document. He opens the uploaded image, checks the policy number, coverage type (commercial auto), and expiration date. It checks out — he clicks "Approve." Takes 90 seconds.

Next: a provider named Ray uploaded a blurry, unreadable insurance doc. Davon clicks "Reject" and types a quick reason: "Image is unreadable. Please re-upload a clear photo of your insurance declaration page." Ray will get a notification.

He checks the "Awaiting Background Check" section — two providers submitted 2 days ago. One shows "Clear" from Checkr (auto-updated via webhook). The other shows "Pending" — still processing. Nothing for Davon to do there.

**Climax:** The "Ready for Final Review" provider is Keisha — all steps complete, background check cleared with "consider" adjudication. Davon reviews the full profile: insurance approved, ASE certification uploaded, vehicle photos look good, training acknowledged, Stripe Connect complete, background check details reviewed. He clicks "Activate Provider."

**Resolution:** Davon's morning pipeline review took 12 minutes for 3 actions. He can see at a glance where every in-progress provider stands. No emails to chase, no spreadsheets to update. The pipeline clears itself as providers complete steps and external checks come back.

**Requirements revealed:** Admin pipeline dashboard (providers grouped by stage), document review UI (view uploaded image, approve/reject with reason), background check status display (auto-updated), final review checklist view (all steps at a glance), batch workflow efficiency (< 15 min for ~10 providers), filter/search for providers by stage.

---

### Journey 4: DeAndre — The Invited Provider (Invite Flow Merge)

DeAndre is an experienced tow operator that Davon (admin) met at an industry meetup. Davon wants to get him onto the platform.

**Opening Scene:** Davon goes to the admin panel, clicks "Invite Provider," enters DeAndre's email and name. DeAndre receives an email: "You've been invited to join RoadSide ATL as a provider. Click here to get started."

**Rising Action:** DeAndre clicks the link, creates his account (email pre-filled from invite), and lands on the same onboarding dashboard every provider sees — 7 steps to complete. The invite didn't skip anything. But DeAndre has a head start on motivation — he was personally recruited.

DeAndre knocks out all self-serve steps in one sitting (25 minutes). His background check is initiated automatically. He texts Davon: "Done with everything, just waiting on the background check."

**Climax:** Checkr clears in 18 hours. Davon gets a notification that DeAndre is ready for final review. He reviews the profile and activates him immediately.

**Resolution:** DeAndre is live within 24 hours of receiving the invite. The unified pipeline means Davon didn't have to remember whether DeAndre was "invited" or "applied" — same review process, same quality bar, same audit trail.

**Requirements revealed:** Invite flow feeds into same onboarding pipeline, invite token links to account creation with pre-filled email, admin visibility into invite status, same requirements regardless of entry point.

---

### Journey Requirements Summary

| Capability | Revealed By | FRs |
|---|---|---|
| Provider application form (enhanced) | Marcus, Keisha, DeAndre | FR1–FR6 |
| Onboarding progress dashboard (mobile-first) | Marcus, Keisha | FR7–FR12 |
| Document upload with mobile photo capture | Marcus, Keisha | FR13–FR15, FR18 |
| Document rejection + re-upload flow with reasons | Keisha | FR16–FR17, FR20–FR21 |
| Partial progress saving (resume where left off) | Keisha | FR9, FR37 |
| Checkr integration (auto-initiate, webhook updates) | Marcus, Keisha | FR22–FR24 |
| Checkr adjudication handling ("consider" status) | Keisha | FR25–FR28 |
| Stripe Connect Express handoff + return tracking | Marcus | FR29–FR33 |
| Training acknowledgment (checkbox + progress save) | Marcus, Keisha | FR36–FR39 |
| Admin pipeline dashboard (grouped by stage) | Davon | FR40–FR42 |
| Admin document review UI (view, approve, reject with reason) | Davon | FR19–FR20 |
| Admin final review checklist | Davon | FR42–FR45 |
| Invite flow merging into unified onboarding pipeline | DeAndre, Davon | FR3, FR6 |
| Status notifications (email + push) at each step | All | FR55–FR59 |
| Automated payout via Stripe Connect | Marcus | FR52–FR54 |
| Provider availability toggle post-activation | Marcus | Existing platform |

## Domain-Specific Requirements

### Compliance & Regulatory

**FCRA (Fair Credit Reporting Act)**
- Provider must give explicit consent before background check is initiated (checkbox + timestamp)
- Checkr's built-in adverse action workflow handles pre-adverse and final adverse action notices
- Platform stores only: check status (`clear` / `consider` / `suspended` / `adverse_action`), completion date, Checkr report ID
- Full report details are NOT stored on platform — Checkr retains for 7 years per FCRA
- Admin can initiate adverse action via Checkr API when rejecting based on background check

**Stripe Connect (KYC/AML)**
- Stripe handles all identity verification, bank account validation, and tax ID collection for Express accounts
- Platform never stores SSN, bank account numbers, or tax IDs — Stripe owns this data
- 1099-K reporting handled by Stripe for connected accounts above IRS threshold
- Providers manage their own bank info directly through Stripe's dashboard — no admin intermediary

**Georgia Towing Regulations**
- Georgia tow operators must hold a valid towing license — verified as part of "certifications" upload step
- Platform stores uploaded license document + admin verification status
- License expiration date tracked for future re-verification (Growth feature)

**Insurance Requirements**
- Commercial auto insurance required — personal auto policies explicitly rejected
- Minimum coverage thresholds documented in admin review guidelines (recommended: $1M combined single limit for towing, $500K for non-towing mobile mechanics)
- Insurance expiration date captured during admin review for future tracking

### Technical Constraints

**PII Handling**
- Background check consent: stored as immutable audit record (provider ID, timestamp, IP address, consent text version)
- Document uploads (insurance, certs, vehicle photos): S3 with server-side encryption (AES-256), presigned URLs for access
- No PII in application logs — Checkr report IDs and Stripe account IDs are safe to log, personal details are not
- Provider onboarding data follows existing platform audit logging pattern

**Webhook Security**
- Checkr webhooks: verified via HMAC signature validation (Checkr provides signing key)
- Stripe Connect webhooks: verified via Stripe signature validation (existing pattern in codebase)
- Both webhook endpoints rate-limited per existing webhook tier (200 req/min)

**Data Retention Policy**
- Active provider documents: retained for duration of active status
- Deactivated provider documents: retained 1 year post-deactivation, then eligible for deletion
- Background check status + metadata: retained indefinitely (audit trail)
- Background check full reports: not stored (Checkr retains 7 years)
- Stripe Connect account data: managed by Stripe, platform stores only `stripeConnectAccountId`

### Integration Requirements

| Integration | Protocol | Auth | Data Flow |
|---|---|---|---|
| Checkr | REST API + Webhooks | API key + HMAC webhook signatures | Create candidate → create invitation → receive webhook status updates |
| Stripe Connect | REST API + Webhooks + Hosted Onboarding | Secret key + OAuth + webhook signatures | Create connected account → generate onboarding link → receive webhook for account updates |
| S3 | AWS SDK | IAM credentials + presigned URLs | Generate presigned upload URL → provider uploads directly → store S3 key in DB |

### Compliance Risk Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Background check data breach | FCRA violation, legal liability | Don't store full reports — only status + Checkr report ID |
| Provider dispatched before check clears | Liability exposure, safety risk | Hard gate: `backgroundCheckStatus !== 'clear'` blocks dispatch eligibility |
| Insurance lapse post-activation | Provider operating without coverage | Growth feature: track expiration dates, notify admin 30 days before expiry |

See [Risk Mitigation Strategy](#risk-mitigation-strategy) in Project Scoping for comprehensive technical, market, and resource risk coverage.

## Technical Architecture

Mobile-first authenticated feature extending the existing Next.js 16 / Hono / shadcn/ui platform. No new frameworks. Key technical considerations: mobile document capture UX, external service handoffs (Stripe, Checkr), and real-time state synchronization via WebSocket.

### Technical Architecture Considerations

**Middleware & Access Control**
- New `requireOnboardingComplete` middleware gates access to the full provider portal (`/provider/jobs`, `/provider/stats`, etc.)
- Providers with incomplete onboarding are redirected to `/provider/onboarding`
- Existing `requireProvider` middleware handles role-level auth; the new middleware handles lifecycle-level access
- Onboarding pages accessible to any user with `role: 'provider'` regardless of onboarding status

**Mobile-First Document Capture**
- Camera capture via `accept="image/*" capture="environment"` on file inputs
- Photo preview with "Retake" / "Submit" choice before upload — prevents blurry upload → rejection cycle
- Document type guidance shown before camera opens (brief instruction + example of what a valid document looks like)
- Client-side image compression before upload (target < 2MB per image)
- S3 presigned URL PUT upload with automatic retry (exponential backoff: 3 retries at 1s, 3s, 9s)
- No multipart upload — standard presigned PUT sufficient for doc photos (1-4MB typical)
- HEIC accepted as-is — no client-side conversion; handle server-side if needed or rely on modern browser rendering
- File validation: magic byte verification server-side (existing S3 security pattern)

**Stripe Connect Express Handoff**
- Opens in new tab via `window.open()` — provider retains onboarding dashboard context
- Return URL configured on Stripe account link creation (`return_url` parameter)
- Refresh URL configured for providers who need to re-enter Stripe flow (`refresh_url` parameter)
- On return: page detects Stripe completion via query parameter, triggers status check API call
- Stripe Connect account status tracked via webhooks (`account.updated` event)
- Fallback: polling endpoint to check `account.details_submitted` and `charges_enabled` status

**Real-Time Onboarding Updates (WebSocket)**
- Extend existing WebSocket infrastructure with new event types:
  - `onboarding:step_completed` — a step status changed (Checkr cleared, admin approved doc)
  - `onboarding:document_reviewed` — admin approved/rejected a document
  - `onboarding:activated` — provider fully activated
  - `onboarding:action_required` — provider needs to re-upload or take action
- Provider's onboarding dashboard subscribes on mount, updates step statuses live
- Admin pipeline view subscribes to all onboarding events for real-time queue updates

**Onboarding State Persistence**
- Server-side progress tracking via `onboardingProgress` JSONB column on `providers` table
- Enables cross-device continuity (start on phone, finish on desktop)
- Stores: per-step completion status, partial training progress, document upload metadata
- No localStorage dependency for critical state — only used for transient UI state

**Upload Resilience**
- Automatic retry with exponential backoff (3 retries: 1s, 3s, 9s)
- Queue failed uploads for retry when connection restores (`navigator.onLine` detection)
- Visual state per document: "Not uploaded" → "Uploading..." → "Pending review" → "Approved" / "Rejected: [reason]"
- Each document card shows its own lifecycle status independently

### Browser Support & Accessibility

- **Browser Support:** Modern evergreen browsers — Chrome 90+, Safari 15+, Firefox 90+, Edge 90+, iOS Safari 15+
- **Accessibility Target:** WCAG 2.1 AA via shadcn/ui defaults — semantic HTML, keyboard navigation, sufficient color contrast, ARIA labels on interactive elements

### Responsive Design Requirements

- All onboarding screens fully functional at 375px width (iPhone SE minimum)
- Card-per-step dashboard pattern: each onboarding step is a tappable card with status indicator and single prominent action button
- No nested navigation — tap card → do the thing → back to dashboard
- Document upload buttons thumb-reachable (bottom half of screen on mobile)
- Admin pipeline view: responsive table with horizontal scroll on mobile, full table on desktop
- Document review modal: full-screen on mobile with pinch-to-zoom on uploaded images

### Implementation Guidance

**Route Structure (Next.js App Router)**
- Provider onboarding pages: `app/(provider)/provider/onboarding/` route group
- Uses existing `(provider)` route group with `requireProvider` middleware
- New `requireOnboardingComplete` middleware on non-onboarding provider routes
- Sub-pages: `/onboarding` (dashboard), `/onboarding/training`, `/onboarding/documents`, `/onboarding/stripe-setup`

**API Endpoints (Hono)**
- New route module: `server/api/routes/onboarding.ts` — provider-facing (progress, upload URLs, document submission, training completion, Stripe link generation, background check consent)
- Extend `server/api/routes/admin-providers.ts` — admin-facing review endpoints (document review, pipeline view, activation)
- Extend `server/api/routes/webhooks.ts` — add Checkr webhook processing alongside existing Stripe webhooks (centralized webhook handling)

**Component Architecture**
- New components in `components/onboarding/` — onboarding dashboard, step cards, document uploader with preview, training checklist
- Reuse existing `components/ui/` (shadcn) for all primitives
- Admin components in `components/admin/` — pipeline view, document review modal with zoom

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Platform MVP — minimum infrastructure to get a provider from application to first dispatchable job with full compliance coverage. No corners cut on safety. Vehicle/equipment documentation deferred. Training scoped as v1 policy acknowledgment cards (richer module in Phase 2).

**Resource Requirements:** Solo developer + admin (Beel) for document reviews. No external design resources — shadcn/ui covers UI. Policy/training content authoring is a non-engineering dependency.

**Parallel Payout Transition:** Stripe Connect payouts for all new providers. Existing providers on legacy manual batch until migrated. **60-day hard cap** — after 60 days, manual payouts deprecated. Forces migration completion.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Marcus (happy path new provider) — full journey
- Keisha (edge cases — rejection, re-upload, adjudication) — full journey
- Davon (admin pipeline management) — full journey
- DeAndre (invited provider merge) — full journey
- Existing provider migration — streamlined dashboard showing only missing steps

**Must-Have Capabilities:**

| Capability | Rationale |
|---|---|
| Enhanced provider application form | Entry point for all new providers |
| Checkr integration (criminal + MVR) | Hard gate — non-negotiable for safety/liability |
| Insurance document upload + admin review | Liability protection, commercial auto required |
| Certification upload + admin review | Georgia towing license, ASE certs |
| Training v1 (5-7 policy acknowledgment cards) | Dispatch protocols, safety, cancellation, payment terms. Writable in an afternoon. |
| Stripe Connect Express onboarding | Automated payouts, replaces manual batch |
| Provider onboarding dashboard (mobile-first, card-per-step) | Progress tracking, flexible ordering |
| Admin pipeline view + document review UI | Operational workflow for onboarding queue |
| `requireOnboardingComplete` middleware | Gates provider portal until fully onboarded |
| Onboarding state machine (`applied → onboarding → pending_review → active / rejected / suspended`) | Status tracking, audit trail |
| WebSocket onboarding events | Real-time dashboard updates |
| Checkr + Stripe Connect polling fallbacks | Webhook resilience |
| Conditional payout routing (Stripe Connect vs. manual batch) | Single `if` check in batch payout flow — not parallel architecture |
| Existing provider migration flow | Streamlined dashboard + 30-day per-provider grace period |
| Migration notification cadence (Day 0, 14, 25, 30) | Email + SMS + push at each milestone |

**MVP Dependencies (Non-Engineering):**
- Training policy content authored (5-7 topics: dispatch protocol, safety procedures, cancellation policy, payment terms, service area, platform terms)
- Checkr account setup + API key provisioning
- Stripe Connect platform account activation (requires Stripe approval — apply early, 1-2 weeks)
- Admin review guidelines document (insurance coverage thresholds, certification requirements)

**Deferred from MVP:**
- Vehicle/equipment documentation upload (Phase 2)
- Training v2 with richer content/scenarios (Phase 2)
- Automated insurance verification (Phase 2)
- Onboarding analytics dashboard (Phase 2)
- Bulk admin review tools (Phase 2)

### Delivery Sequence (Testability-Optimized)

| Order | Deliverable | Rationale |
|---|---|---|
| 1 | Schema changes + state machine + onboarding dashboard skeleton | Foundation — provider-facing UI shell |
| 2 | Admin pipeline UI + document review | Admin can see and act on submissions |
| 3 | Checkr integration (API + webhooks + polling) | End-to-end testable with admin UI |
| 4 | Stripe Connect integration (API + webhooks + polling) | End-to-end testable with admin UI |
| 5 | Training module v1 + document upload flows | Complete provider self-serve experience |
| 6 | Migration flow + notification system | Final piece, leverages all prior work |

### Post-MVP Features

**Phase 2 (Growth):**

| Feature | Trigger |
|---|---|
| Vehicle/equipment documentation | Provider volume > 20, equipment verification needed |
| Training v2 (scenarios, richer content) | When v1 proves insufficient for provider quality |
| Automated insurance verification | Admin review time > 30 min/day |
| Provider referral bonuses | Organic acquisition slows |
| Tiered onboarding (diagnostic-only vs. towing) | Diagnostic provider demand emerges |
| Onboarding analytics dashboard | Funnel optimization becomes priority |
| Bulk admin review tools | Concurrent onboarding > 20 providers |
| Insurance expiration tracking + renewal alerts | After 6 months of active providers |

**Phase 3 (Expansion):**

| Feature | Trigger |
|---|---|
| AI-assisted document review | Admin review becomes bottleneck at scale |
| Annual background re-check automation | After first year of operations |
| Provider skill assessments | Service quality variance becomes measurable |
| Multi-market onboarding | RoadSide expands beyond Atlanta |
| Dynamic onboarding requirements per market | State-level regulatory differences require it |

### Existing Provider Migration Strategy

**Approach:** Launch new onboarding and migration simultaneously. Existing providers see a streamlined migration dashboard showing only missing steps (not the full 8-step flow). Same backend, different frontend entry point.

**Grace Period:** 30 days from each provider's notification date (not a fixed calendar deadline). Stagger notifications to control admin review load.

**Migration Completion Target:** > 90% (higher bar than new providers — existing providers have earnings at stake).

**Notification Cadence:**

| Day | Channel | Message |
|---|---|---|
| 0 | Email + SMS + Push | "New compliance requirements. Complete by [date]. Here's what you need to do." Link to migration dashboard. |
| 14 | Email + SMS + Push | Reminder to those who haven't started — "16 days remaining." |
| 25 | Email + SMS + Push | Urgent — "5 days remaining. Your account will be suspended." |
| 30 | System action | Account status set to `suspended`. Can't receive new jobs. Can still complete migration to reactivate. |

**Post-Deadline:** Suspended providers retain their account, earnings history, and reviews. Completing migration at any time reactivates them. No data loss, no permanent consequences — just a gate.

**Payout Deprecation:** Manual batch payouts deprecated 60 days after migration launch. Any provider not on Stripe Connect by then is suspended regardless of other compliance status.

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Checkr API integration complexity | Medium | High | Use Checkr's Node.js SDK; sandbox environment for testing |
| Stripe Connect approval delay | Low | High | Apply for platform account early; 1-2 weeks typical |
| State machine edge cases | Medium | Medium | Comprehensive status transition tests; audit log every transition |
| Webhook delivery failures | Low | High | Polling fallback for both Checkr and Stripe; reconciliation every 4 hours |

**Market Risks:**

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Existing providers refuse migration | Medium | High | 30-day grace period, multi-channel reminders, personal outreach for top providers. Suspension (not deletion) at deadline. |
| Background check friction kills acquisition | Low | Medium | 80% completion target with funnel monitoring. Flexible ordering reduces friction. |
| Training content not authored in time | High | Medium | Launch with v1 (5-7 policy cards). Content writable in an afternoon. Richer v2 in Phase 2. |

**Resource Risks:**

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Solo developer bottleneck | Medium | Medium | Testability-optimized delivery sequence — each deliverable is independently testable |
| Admin overwhelmed during migration | Medium | Medium | Stagger notifications 3-4 providers per week; each gets 30 days from their notification |

## Functional Requirements

### 1. Provider Application & Registration

- **FR1:** Prospective provider can submit an application with personal info, contact details, service area, and specialties
- **FR2:** Prospective provider can create an account during application with email and password
- **FR3:** Invited provider can accept an invite link and create an account with pre-filled email
- **FR4:** Prospective provider can give explicit FCRA consent for background check during application (checkbox + timestamp recorded)
- **FR5:** System initiates background check automatically upon application submission with valid consent
- **FR6:** Both invited and self-registered providers enter the same unified onboarding pipeline

### 2. Onboarding Progress Management

- **FR7:** Provider can view an onboarding dashboard showing all required steps with current status for each
- **FR8:** Provider can complete onboarding steps in any order
- **FR9:** Provider can resume onboarding from any device with progress preserved
- **FR10:** Provider's onboarding dashboard updates in real-time when step statuses change
- **FR11:** System tracks provider onboarding state through defined statuses: `applied → onboarding → pending_review → active / rejected / suspended`
- **FR12:** System prevents providers with incomplete onboarding from accessing the full provider portal (jobs, earnings, stats)

### 3. Document Upload & Review

- **FR13:** Provider can upload documents (insurance, certifications) using camera capture from mobile device
- **FR14:** Provider can preview a captured photo and choose to retake or submit before uploading
- **FR15:** Provider can see document-type-specific guidance before capturing (what a valid document looks like)
- **FR16:** Provider can see per-document status independently: not uploaded, uploading, pending review, approved, rejected with reason
- **FR17:** Provider can re-upload a document after rejection with the rejection reason visible
- **FR18:** System automatically retries failed uploads
- **FR19:** Admin can view an uploaded document image with zoom capability
- **FR20:** Admin can approve or reject a document with a required reason for rejection
- **FR21:** Provider receives notification (email + push) when a document is approved or rejected

### 4. Background Check (Checkr Integration)

- **FR22:** System creates a Checkr candidate and initiates criminal + MVR check upon provider consent
- **FR23:** System receives and processes Checkr webhook status updates (clear, consider, suspended, adverse_action)
- **FR24:** System runs a polling fallback job for background checks pending longer than 24 hours
- **FR25:** Admin can view background check status and result summary for any provider
- **FR26:** Admin can initiate Checkr adverse action workflow when rejecting based on background check
- **FR27:** Admin can approve a provider with "consider" background check status (adjudication decision)
- **FR28:** System blocks provider from dispatch eligibility until background check status is "clear" or admin-approved "consider"

### 5. Stripe Connect Express

- **FR29:** Provider can initiate Stripe Connect Express onboarding from the onboarding dashboard
- **FR30:** Provider can return to the onboarding dashboard after completing Stripe's hosted flow with status automatically updated
- **FR31:** Provider can re-enter Stripe Connect flow if they abandoned it partway through
- **FR32:** System receives and processes Stripe `account.updated` webhooks to track Connect onboarding status
- **FR33:** System runs a polling fallback to check Stripe Connect account completion status
- **FR34:** System sends reminder notifications to providers who started but haven't completed Stripe Connect (at 24h and 72h)
- **FR35:** Provider can manage their bank account and tax info directly through Stripe's dashboard (no admin intermediary)

### 6. Training & Policy Acknowledgment

- **FR36:** Provider can view and complete training modules consisting of policy acknowledgment cards
- **FR37:** Provider can complete training incrementally with progress saved between sessions
- **FR38:** Each training card requires the provider to acknowledge they've read and understood the content
- **FR39:** System tracks which training cards have been acknowledged and which remain

### 7. Admin Onboarding Pipeline

- **FR40:** Admin can view all providers in the onboarding pipeline grouped by current stage
- **FR41:** Admin can filter and search providers by onboarding stage, name, or application date
- **FR42:** Admin can view a complete onboarding checklist for any provider showing all step statuses at a glance
- **FR43:** Admin can activate a provider after all onboarding steps are complete (final review)
- **FR44:** Admin can reject a provider at any point with a reason
- **FR45:** Admin receives real-time updates when providers complete onboarding steps or submit documents

### 8. Existing Provider Migration

- **FR46:** Existing provider can view a migration dashboard showing only the steps they need to complete (not the full onboarding flow)
- **FR47:** System determines which onboarding steps an existing provider has already satisfied and marks them complete. Satisfaction rules: linked user account → account creation satisfied; existing provider record with active status → application satisfied; no existing data satisfies background check, document uploads, training, or Stripe Connect — these must be completed during migration
- **FR48:** Existing provider retains full platform access during their 30-day grace period while completing migration
- **FR49:** System sends migration notifications at Day 0, Day 14, Day 25, and Day 30 via email, SMS, and push
- **FR50:** System automatically suspends providers who haven't completed migration by their deadline
- **FR51:** Suspended provider can complete remaining migration steps at any time to reactivate their account

### 9. Payout Transition

- **FR52:** System routes payouts through Stripe Connect for providers with a connected account
- **FR53:** System continues routing payouts through manual batch process for providers without a connected Stripe account
- **FR54:** System deprecates manual payout support 60 days after migration launch

### 10. Notifications & Communication

- **FR55:** Provider receives email, SMS, and push notification when their application is received
- **FR56:** Provider receives notification when any onboarding step status changes (document reviewed, background check complete, activation)
- **FR57:** Provider receives notification when admin action is required from them (re-upload, additional info)
- **FR58:** Admin receives notification when a provider is ready for final review (all steps complete)
- **FR59:** Admin receives notification when a new document is submitted for review

## Non-Functional Requirements

### Performance

| NFR | Requirement | Measurement |
|---|---|---|
| NFR-P1 | Onboarding dashboard initial load completes in < 1.5 seconds on 4G connection | Server-side render with progress data; measured via Lighthouse or field metrics |
| NFR-P2 | Document photo preview renders within 500ms of capture | Client-side — image appears in preview area before upload begins |
| NFR-P3 | Presigned URL generation returns within 500ms | API response time for upload initiation endpoint |
| NFR-P4 | Client-side image compression completes in < 2 seconds for photos up to 10MB | On-device processing before upload — measured on mid-range Android (Pixel 6a or equivalent) |
| NFR-P5 | Stripe Connect account link generation returns within 2 seconds | API call to Stripe to create onboarding link |
| NFR-P6 | Real-time onboarding event delivery to connected clients within 500ms of server-side state change | Time from status update in DB to client receiving the event |
| NFR-P7 | Admin pipeline view loads < 2 seconds with up to 50 in-progress providers | Server-side query with stage grouping; pagination if beyond 50 |

### Security

| NFR | Requirement | Measurement |
|---|---|---|
| NFR-S1 | All document uploads stored with server-side encryption at rest | Bucket policy enforced; no unencrypted objects |
| NFR-S2 | Presigned upload URLs expire within 15 minutes of generation | S3 presigned URL `Expires` parameter |
| NFR-S3 | Presigned download URLs for admin document review expire within 10 minutes | Short-lived; no persistent public URLs to provider documents |
| NFR-S4 | FCRA consent recorded as immutable audit record (provider ID, timestamp, IP, consent version) | Cannot be modified or deleted; audit trail queryable |
| NFR-S5 | No PII stored beyond what's strictly necessary — Checkr stores full reports, Stripe stores financial data, platform stores only IDs and status | Data inventory audit confirms no SSN, bank numbers, tax IDs, or full background report content in platform DB |
| NFR-S6 | Checkr webhooks validated via cryptographic signature on every request; invalid signatures rejected with 401 | Webhook handler rejects unsigned/tampered payloads |
| NFR-S7 | Stripe Connect webhooks validated via Stripe signature (existing pattern) | Same validation as existing Stripe payment webhooks |
| NFR-S8 | Uploaded files validated server-side via file content inspection — reject non-image files regardless of extension | Existing security pattern extended to onboarding uploads |
| NFR-S9 | Provider document URLs never exposed to other providers or customers — scoped to admin and the owning provider | API authorization checks on document access endpoints |
| NFR-S10 | Background check status transitions logged to audit trail with actor, timestamp, and previous/new status | Leverages existing audit logger pattern |

### Scalability

| NFR | Requirement | Measurement |
|---|---|---|
| NFR-SC1 | System supports 10 concurrent providers in onboarding pipeline without performance degradation | Admin pipeline view, webhook processing, and state updates all performant at 10 concurrent |
| NFR-SC2 | System supports migration burst of up to 30 existing providers notified in the same week | Staggered notification cadence prevents admin review overload |
| NFR-SC3 | Checkr polling fallback job handles up to 50 pending checks per run without timeout | Job completes within 60 seconds; batched API calls |
| NFR-SC4 | Stripe Connect polling fallback handles up to 50 pending accounts per run | Same pattern as Checkr polling |
| NFR-SC5 | Document storage scales linearly — estimated 5-8 documents per provider, ~2MB average per document | S3 handles this natively; no application-level storage concern |

### Integration Reliability

| NFR | Requirement | Measurement |
|---|---|---|
| NFR-I1 | Checkr webhook processing achieves 99.9% successful delivery handling | Webhook endpoint returns 200 for valid payloads; failures logged and alertable |
| NFR-I2 | Checkr polling fallback activates for any check pending > 24 hours; runs every 4 hours | No provider stuck in "pending background check" for more than 28 hours due to missed webhook |
| NFR-I3 | Stripe Connect polling fallback activates for any account not updated via webhook within 4 hours of Stripe flow completion | Catches cases where provider completes Stripe flow but `account.updated` webhook doesn't fire |
| NFR-I4 | All external API calls (Checkr, Stripe) include automatic retry with progressive delay (3 retries) | Failed API calls don't immediately fail the provider's action |
| NFR-I5 | Webhook endpoints return 200 within 5 seconds to prevent external service retries | Async processing after acknowledgment if needed |
| NFR-I6 | State reconciliation ensures zero orphaned provider states — every provider has a valid, actionable status at all times | Weekly reconciliation report confirms no providers in unrecoverable states |
| NFR-I7 | External service outages (Checkr down, Stripe down) gracefully degrade — provider sees "temporarily unavailable, try again later" instead of errors | No 500 errors surfaced to providers due to downstream outages |

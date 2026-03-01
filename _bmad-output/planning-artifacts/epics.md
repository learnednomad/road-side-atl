---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
status: 'complete'
completedAt: '2026-02-12'
revisedAt: '2026-02-12'
revisionNote: 'Rev 2: Fixed 3 critical issues from readiness re-run: Story 4.4 split into 4.4/4.5/4.6, missing schema definitions added (priceOverrideCents, taxId, clawback records), referralCode timing conflict resolved. Rev 1: Fixed 11 issues from initial readiness report.'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
---

# road-side-atl - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for road-side-atl, decomposing the requirements from the PRD and Architecture into implementable stories. 9 epics covering 83 FRs with 27 stories.

## Requirements Inventory

### Functional Requirements

**Service Booking & Dispatch (FR1-FR12)**

FR1: Customers can book emergency roadside services by selecting a service type and confirming their location
FR2: Customers can book scheduled services by selecting a service type, location, date, and time
FR3: The system can auto-detect the customer's GPS location and pre-fill the booking location field
FR4: Customers can manually enter or override their location if GPS is unavailable or inaccurate
FR5: The system can auto-dispatch the nearest available provider matching the requested service type
FR6: The system can cascade dispatch to the next nearest provider when the first provider declines or times out
FR7: The system can apply priority dispatch for B2B contract accounts and subscription holders
FR8: Customers can select from tiered diagnostic products (Basic, Standard, Premium) during booking
FR9: Customers can view transparent pricing including time-block multipliers before confirming a booking
FR10: The system can apply time-block pricing multipliers automatically based on the time of booking (Standard, After-Hours, Emergency)
FR11: Customers can cancel a booking before a provider is dispatched
FR12: The system can expand the provider search radius if no provider is available within the default range

**Payment & Financial Operations (FR13-FR25)**

FR13: The system can restrict new customers (Trust Tier 1) to non-reversible payment methods only (Cash, CashApp, Zelle)
FR14: The system can unlock card payment access for customers who complete a configurable number of clean transactions
FR15: Customers can view their Trust Tier progress and current payment method eligibility
FR16: Admins can manually promote or demote a customer's Trust Tier status
FR17: Customers can pay for services using Cash, CashApp, Zelle, or credit card (based on Trust Tier eligibility)
FR18: Admins can confirm manual payment receipt (CashApp, Zelle, Cash) for completed bookings
FR19: The system can calculate provider payouts using service-category-specific commission rates
FR20: Admins can process provider payouts individually or in batches
FR21: The system can generate payment receipts and email them to customers upon payment confirmation
FR22: Admins can initiate partial or full refunds with corresponding provider payout adjustments
FR23: The system can apply surge/event pricing multipliers when Storm Mode is activated by admin
FR24: Admins can view revenue analytics broken down by source (B2B/B2C), service category, payment method, and time-block tier
FR25: The system can generate audit log entries for all financial mutations (payment confirmations, payouts, refunds, Trust Tier changes)

**Real-Time Tracking & Communication (FR26-FR34)**

FR26: Customers can track the dispatched provider's location in real-time on a live map
FR27: Customers can view the provider's name, photo, rating, and estimated time of arrival
FR28: The system can broadcast provider GPS position updates to the customer during active bookings
FR29: The system can send automated delay notifications when provider ETA exceeds a configurable threshold
FR30: The system can send booking confirmation notifications via SMS and email
FR31: The system can send provider assignment notifications to both customer and provider
FR32: The system can send service completion notifications to the customer
FR33: The system can send automated referral link via SMS within a configurable time after service completion
FR34: The system can send Trust Tier progression notifications when a customer unlocks card payment

**Provider Management (FR35-FR47)**

FR35: Prospective providers can submit an application with personal information, vehicle details, insurance verification, service area, and available hours
FR36: Admins can review, approve, deny, or request resubmission for provider applications
FR37: Providers can toggle their availability status (online/offline)
FR38: Providers can configure their service area by zone
FR39: Providers can receive job notifications with service type, distance, price, and their payout amount
FR40: Providers can accept or decline job notifications within a configurable timeout
FR41: Providers can update job status through the service lifecycle (en route, arrived, in progress, completed)
FR42: Providers can view their earnings (per-job breakdown, daily, weekly, monthly totals)
FR43: Providers can view their commission tier and how service category affects their payout percentage
FR44: Providers can submit vehicle observation notes and photos during or after service
FR45: Providers can upload pre-service photos for documentation purposes
FR46: Providers can view their rating and review history
FR47: Providers can refer other providers and track referral status

**Customer Account & Trust (FR48-FR55)**

FR48: Customers can create an account after their first booking (guest booking supported for first service)
FR49: Customers can authenticate via Google OAuth or email/password credentials
FR50: Customers can view their booking history and service records
FR51: Customers can view and manage their payment methods
FR52: Customers can rate and review their provider after service completion
FR53: Customers can view and share their unique referral link
FR54: Customers can receive and redeem referral credits on future bookings
FR55: A user can hold both customer and provider roles simultaneously on a single account

**B2B Account Management (FR56-FR63)**

FR56: Admins can create and manage B2B business accounts with company profiles (name, billing address, contact, payment terms)
FR57: Admins can configure B2B contracts with retainer amounts, per-job rates, included services, and contract dates
FR58: B2B account holders can request services on behalf of their residents or customers
FR59: The system can tag bookings to B2B business accounts for consolidated billing
FR60: The system can generate monthly itemized invoices for B2B accounts
FR61: Admins can track invoice status (draft, sent, paid, overdue) for B2B accounts
FR62: The system can send invoice notifications via email to B2B billing contacts
FR63: The system can notify residents/customers of incoming service dispatched by their B2B account holder

**Diagnostics & Inspection (FR64-FR71)**

FR64: Customers can book pre-purchase vehicle inspections at a specified location, date, and time
FR65: Customers can select from tiered inspection products with clearly displayed features and pricing
FR66: The system can send pre-service confirmation with inspector name and arrival time
FR67: Providers can capture and submit inspection findings including OBD2 data, photos, and measurements
FR68: The system can generate a branded PDF inspection report from submitted findings
FR69: The system can email the branded inspection report to the customer within a configurable time after completion
FR70: Providers can submit structured vehicle observation checklists during any service type (not just diagnostics)
FR71: The system can trigger follow-up notifications to customers based on provider observations

**Platform Administration (FR72-FR83)**

FR72: Admins can view a dashboard with pending payments, payout queue, revenue analytics, provider status, and booking overview
FR73: Admins can configure Trust Tier thresholds (number of completions required for card unlock)
FR74: Admins can configure commission rates per service category
FR75: Admins can configure time-block pricing windows and multiplier percentages
FR76: Admins can activate and deactivate Storm Mode with configurable surge multipliers and start/end times
FR77: Admins can select from pre-built Storm Mode templates (Ice Storm, Falcons Game, Holiday Weekend)
FR78: Admins can view and manage all active, completed, and cancelled bookings
FR79: Admins can add internal notes to booking records (not visible to customers)
FR80: Admins can configure provider checklists with required steps per service type
FR81: Admins can view system health information (WebSocket status, deployment health)
FR82: Admins can export provider earnings data in 1099-ready format annually
FR83: Admins can override pricing on individual bookings

### NonFunctional Requirements

**Performance (NFR1-NFR10)**

NFR1: Page load time (LCP) shall be < 2.0 seconds on 4G mobile connections as measured by Lighthouse and real user monitoring
NFR2: API response time shall be < 340ms at p95 under normal load as measured by server-side APM
NFR3: Booking-to-dispatch cycle shall complete in < 5 seconds end-to-end (server-side matching < 500ms + notification delivery)
NFR4: First Input Delay (FID) shall be < 100ms on mobile devices
NFR5: Cumulative Layout Shift (CLS) shall be < 0.1 across all customer-facing pages
NFR6: Time to First Byte (TTFB) shall be < 400ms from the deployment environment
NFR7: Booking flow total page weight shall be < 500KB (HTML + CSS + JS + fonts) with Google Maps loaded asynchronously
NFR8: WebSocket reconnection after mobile network drop shall complete in < 3 seconds with exponential backoff and jitter
NFR9: GPS position update delivery latency shall be < 500ms at p95 during active tracking
NFR10: PDF inspection report generation shall complete within 30 seconds and not block the post-service email pipeline

**Security (NFR11-NFR20)**

NFR11: The system shall never store raw credit card numbers — all card data handled exclusively through Stripe tokenization
NFR12: Trust Tier enforcement shall have zero bypass paths — automated test coverage on every deploy shall verify Tier 1 users cannot access card payment endpoints
NFR13: Provider SSN/EIN data (for 1099 reporting) shall be encrypted at rest using AES-256 or equivalent
NFR14: All financial audit log entries shall be immutable — no soft deletes, no modifications after creation
NFR15: Authentication shall enforce session expiration after 24 hours of inactivity with re-authentication required
NFR16: API rate limiting shall enforce 10 requests/minute on booking creation endpoints per IP address
NFR17: Admin routes shall be inaccessible to customer and provider roles — server-side RBAC enforcement on every request
NFR18: WebSocket connections shall require authenticated session tokens — unauthenticated connections rejected immediately
NFR19: Provider GPS location data shall only be transmitted to customers during active bookings — no background tracking, no retention beyond booking lifecycle
NFR20: CashApp/Zelle transaction IDs shall be logged for reconciliation but no bank account details stored in the database

**Scalability (NFR21-NFR28)**

NFR21: The system shall support 50 simultaneous active bookings in Phase 1 without degradation
NFR22: The system shall support 200 simultaneous active bookings by Phase 4 through horizontal scaling capability
NFR23: WebSocket server shall handle 50 concurrent connections in Phase 1 with upgrade path to 200+ via pub/sub message broker if needed
NFR24: Database queries on booking, payment, and provider tables shall maintain < 100ms response time with proper indexing at 100K+ booking records
NFR25: Google Maps API usage shall be optimized to < 900 calls/week at Phase 4 volume (150 bookings/week) through client-side caching and batched distance matrix requests
NFR26: SMS notification throughput shall support 600+ messages/week at Phase 4 volume (150 bookings x 4 messages/booking)
NFR27: The database schema shall support multi-tenant B2B account isolation without schema changes as B2B accounts scale from 3 to 50+
NFR28: Stripe webhook processing shall handle burst delivery of up to 100 events/minute during payment reconciliation windows

**Reliability (NFR29-NFR38)**

NFR29: System uptime shall be > 99.5% monthly (< 3.6 hours/month planned maintenance) as measured by health check monitoring
NFR30: Active booking state shall persist to the database — application restarts shall recover all in-progress bookings without data loss
NFR31: Database automated backups shall run every hour with Recovery Point Objective (RPO) < 1 hour
NFR32: Lost booking rate shall be 0% — every submitted booking shall persist through database-level constraints and application-level validation
NFR33: Stripe webhook delivery shall achieve 99.99%+ reliability with dead-letter queue for failed deliveries and admin alerting
NFR34: Double-charge rate shall be 0% — idempotency keys enforced on every payment operation
NFR35: Manual payment confirmation (CashApp/Zelle/Cash) shall be processed within 4 hours of receipt
NFR36: Auto-dispatch failover shall trigger within 2 minutes when the primary provider declines or times out, with configurable cascade depth
NFR37: Health check endpoint (`/api/health`) shall respond within 5 seconds and cover database connectivity, WebSocket server status, and Stripe API reachability
NFR38: WebSocket heartbeat/keepalive shall fire every 20 seconds to prevent proxy timeout disconnections

**Accessibility (NFR39-NFR45)**

NFR39: All customer-facing pages shall conform to WCAG 2.1 Level AA standards
NFR40: All interactive elements shall be keyboard-navigable with visible focus indicators
NFR41: Color contrast ratio shall meet 4.5:1 minimum for normal text and 3:1 for large text and UI components
NFR42: All form inputs shall have associated labels — form validation errors announced to screen readers via ARIA live regions
NFR43: Touch targets on mobile shall be minimum 44x44px per Apple HIG — critical for stressed users in emergency situations
NFR44: No hover-dependent interactions in customer or provider flows — all actions achievable via tap/click
NFR45: Map animations and transitions shall respect the `prefers-reduced-motion` user preference

**Integration (NFR46-NFR50)**

NFR46: All API endpoints shall validate request payloads using schema validation with structured error responses including error codes
NFR47: All database access shall go through the ORM layer — no raw SQL queries outside of migrations
NFR48: Stripe integration shall use webhook signature verification on every incoming event to prevent spoofing
NFR49: SMS notifications (Twilio) shall include delivery status tracking with retry logic for failed sends
NFR50: Email notifications (Resend) shall use templated content with unsubscribe links per CAN-SPAM compliance

### Additional Requirements

**From Architecture Document:**

- **Brownfield codebase** — No starter template needed. Existing codebase is 85% built. All 9 MVP features extend existing patterns using the established 6-file feature checklist.
- **Trust Tier data model** — Add `trustTier` (integer, default 1) and `cleanTransactionCount` (integer, default 0) columns to existing `users` table. Not a separate entity.
- **Trust Tier defense-in-depth** — Three-layer enforcement: (1) `validatePaymentMethod` Hono middleware, (2) Zod payment schema validation with tier context, (3) Automated deploy test verifying Tier 1 cannot access card endpoints.
- **Time-Block Pricing table** — New `time_block_configs` table with basis-point multipliers (10000 = 1.0x). Must be seeded with defaults: Standard (6-18, 10000bp), After-Hours (18-6, 12500bp), Emergency (Storm Mode, 15000bp).
- **Vehicle Observations as first-class entity** — Separate `observations` table with JSONB `items` column typed via `.$type<ObservationItem[]>()`. Supports follow-up notification pipeline and Front Door 1 → Front Door 2 bridge.
- **Inspection Reports** — Structured data in `inspection_reports` table + on-demand PDF generation via `@react-pdf/renderer`. Node-only — must be isolated in `server/api/lib/pdf-generator.ts`, never imported client-side. HTML preview served instantly, PDF generated on demand.
- **Referral Tracking hybrid model** — `referralCode` column (text, unique, short UUID) on users table + separate `referrals` table for credit lifecycle (pending/credited/expired).
- **Booking Mode toggle** — No schema change needed. Existing `scheduledAt` column (null = immediate, timestamp = scheduled). Feature is purely UI enhancement.
- **6 new API route modules** — trust-tier.ts, pricing-config.ts, observations.ts, inspection-reports.ts, referrals.ts, financial-reports.ts. All must be registered in `server/api/index.ts`.
- **New Trust Tier middleware** — `server/api/middleware/trust-tier.ts` with `validatePaymentMethod` applied to all payment creation paths.
- **Centralized pricing engine** — `server/api/lib/pricing-engine.ts`. Single `calculateBookingPrice()` function. Storm Mode overrides time-block (highest priority). Never calculate price in components.
- **Only 1 new npm dependency** — `@react-pdf/renderer`. Must be added to `serverExternalPackages` in next.config.ts. All other features use existing stack.
- **Implementation dependency chain** — Trust Tier → Payment Flow Hardening → Financial Reporting (critical path). Time-Block Pricing → Booking Flow (chain). Observations, Referral Text, Tiered Commission, Inspection Report (independent).
- **Integer math throughout** — Cents for money, basis points (10000 = 1.0x) for multipliers/commissions. `Math.round(basePrice * multiplier / 10000)` for price calculation. No floating-point financial operations.
- **31 new files, 17 modified files** — Complete directory structure defined with exact file paths for all new and modified files.
- **4 new database schema files** — `db/schema/time-block-configs.ts`, `db/schema/observations.ts`, `db/schema/inspection-reports.ts`, `db/schema/referrals.ts`. All must export from `db/schema/index.ts`.
- **Seed data required** — Time-block pricing defaults must be seeded via `db/seed.ts` modification.
- **New audit action types** — Must be added to `AuditAction` type union in `audit-logger.ts`: `trust_tier.promote`, `trust_tier.demote`, `trust_tier.admin_override`, `pricing.update_block`, `pricing.toggle_storm_mode`, `observation.submit`, `observation.follow_up_sent`, `referral.create`, `referral.credit`, `referral.expire`, `inspection.generate`, `inspection.email_sent`.

### FR Coverage Map

FR1: Epic 4 Story 4.1 - Emergency booking (existing, integrate pricing)
FR2: Epic 4 Story 4.1 - Scheduled booking (existing, add mode toggle)
FR3: Epic 4 Story 4.4 - GPS auto-detection (existing, verify)
FR4: Epic 4 Story 4.4 - Manual location override (existing, verify)
FR5: Epic 4 Story 4.4 - Auto-dispatch nearest provider (existing, verify)
FR6: Epic 4 Story 4.4 - Cascade dispatch on decline/timeout (existing, verify)
FR7: Epic 4 Story 4.4 - Priority dispatch for B2B/subscribers (existing, verify)
FR8: Epic 4 Story 4.3 - Tiered diagnostic product selection (new)
FR9: Epic 4 Story 4.2 - Transparent pricing with time-block multipliers (new)
FR10: Epic 2 Story 2.1 - Automatic time-block pricing application (new)
FR11: Epic 4 Story 4.4 - Cancel booking before dispatch (existing, verify)
FR12: Epic 4 Story 4.4 - Expand provider search radius (existing, verify)
FR13: Epic 1 Story 1.1/1.2 - Restrict Tier 1 to non-reversible payments (new)
FR14: Epic 1 Story 1.1 - Unlock card access after clean transactions (new)
FR15: Epic 1 Story 1.4 - Customer Trust Tier progress view (new)
FR16: Epic 1 Story 1.3 - Admin manual tier promote/demote (new)
FR17: Epic 1 Story 1.2 - Payment method selection by tier eligibility (new)
FR18: Epic 3 Story 3.2 - Admin confirm manual payment receipt (new)
FR19: Epic 3 Story 3.1 - Service-category-specific commission calculation (new)
FR20: Epic 3 Story 3.3 - Admin process payouts individually or batch (new)
FR21: Epic 3 Story 3.2 - Generate and email payment receipts (new)
FR22: Epic 3 Story 3.3 - Admin initiate refunds with payout adjustment (new)
FR23: Epic 2 Story 2.2 - Surge/event pricing via Storm Mode (new)
FR24: Epic 5 Story 5.1 - Revenue analytics by source, category, method, tier (new)
FR25: Epic 1 Story 1.1 - Audit log for all financial mutations (new)
FR26: Epic 4 Story 4.5 - Real-time provider tracking on live map (existing, verify integration)
FR27: Epic 4 Story 4.5 - Provider info and ETA display (existing, verify)
FR28: Epic 4 Story 4.5 - GPS position broadcast during active bookings (existing, verify)
FR29: Epic 4 Story 4.5 - Automated delay notifications (existing, verify)
FR30: Epic 4 Story 4.6 - Booking confirmation via SMS and email (existing, verify)
FR31: Epic 4 Story 4.6 - Provider assignment notifications (existing, verify)
FR32: Epic 3 Story 3.3 - Service completion notifications (existing, verify integration with payment)
FR33: Epic 7 Story 7.1 - Automated post-service referral SMS (new)
FR34: Epic 1 Story 1.4 - Trust Tier progression notifications (new)
FR35: Epic 6 Story 6.2 - Provider application submission (existing, verify)
FR36: Epic 6 Story 6.2 - Admin review provider applications (existing, verify)
FR37: Epic 6 Story 6.2 - Provider availability toggle (existing, verify)
FR38: Epic 6 Story 6.2 - Provider service area configuration (existing, verify)
FR39: Epic 3 Story 3.3 - Provider job notifications with payout (existing, verify commission-adjusted amount)
FR40: Epic 4 Story 4.6 - Provider accept/decline with timeout (existing, verify)
FR41: Epic 4 Story 4.6 - Provider job status lifecycle updates (existing, verify)
FR42: Epic 5 Story 5.2 - Provider earnings view (per-job, daily, weekly, monthly) (new)
FR43: Epic 3 Story 3.1 - Provider commission tier visibility (new)
FR44: Epic 6 Story 6.1 - Provider submit observation notes and photos (new)
FR45: Epic 6 Story 6.1 - Provider upload pre-service photos (new)
FR46: Epic 6 Story 6.2 - Provider rating and review history (existing, verify)
FR47: Epic 7 Story 7.2 - Provider refer other providers (new)
FR48: Epic 1 Story 1.4 - Customer account creation after first booking (existing, verify trust tier init)
FR49: Epic 1 Story 1.4 - Google OAuth and email/password auth (existing, verify)
FR50: Epic 4 Story 4.6 - Customer booking history and service records (existing, verify)
FR51: Epic 1 Story 1.4 - Customer payment methods management (existing, verify tier filtering)
FR52: Epic 4 Story 4.6 - Customer rate and review provider (existing, verify)
FR53: Epic 7 Story 7.2 - Customer view and share referral link (new)
FR54: Epic 7 Story 7.2 - Customer receive and redeem referral credits (new)
FR55: Epic 1 Story 1.4 - Dual customer/provider role support (existing, verify)
FR56: Epic 9 Story 9.1 - Admin create B2B business accounts (Phase 2)
FR57: Epic 9 Story 9.1 - Admin configure B2B contracts (Phase 2)
FR58: Epic 9 Story 9.1 - B2B request services on behalf of others (Phase 2)
FR59: Epic 9 Story 9.1 - Tag bookings to B2B accounts (Phase 2)
FR60: Epic 9 Story 9.2 - Generate monthly B2B invoices (Phase 2)
FR61: Epic 9 Story 9.2 - Admin track B2B invoice status (Phase 2)
FR62: Epic 9 Story 9.2 - B2B invoice email notifications (Phase 2)
FR63: Epic 9 Story 9.2 - B2B resident service dispatch notification (Phase 2)
FR64: Epic 4 Story 4.3 - Book pre-purchase vehicle inspection (new)
FR65: Epic 4 Story 4.3 - Select tiered inspection products (new)
FR66: Epic 8 Story 8.1 - Pre-service confirmation with inspector details (new)
FR67: Epic 8 Story 8.1 - Provider capture inspection findings (new)
FR68: Epic 8 Story 8.2 - Generate branded PDF inspection report (new)
FR69: Epic 8 Story 8.2 - Email inspection report to customer (new)
FR70: Epic 6 Story 6.1 - Structured vehicle observation checklists (new)
FR71: Epic 6 Story 6.2 - Follow-up notifications from observations (new)
FR72: Epic 5 Story 5.1 - Admin dashboard with pending payments, queue, analytics (new)
FR73: Epic 1 Story 1.3 - Admin configure Trust Tier thresholds (new)
FR74: Epic 3 Story 3.1 - Admin configure commission rates per service (new)
FR75: Epic 2 Story 2.3 - Admin configure time-block pricing windows (new)
FR76: Epic 2 Story 2.2 - Admin activate/deactivate Storm Mode (new)
FR77: Epic 2 Story 2.2 - Admin select Storm Mode templates (new)
FR78: Epic 5 Story 5.3 - Admin manage all bookings (existing, verify)
FR79: Epic 5 Story 5.3 - Admin add internal notes to bookings (existing, verify)
FR80: Epic 6 Story 6.1 - Admin configure provider checklists per service (new)
FR81: Epic 5 Story 5.3 - Admin view system health information (existing, verify)
FR82: Epic 5 Story 5.3 - Admin export 1099-ready provider earnings (new)
FR83: Epic 2 Story 2.3 - Admin override pricing on individual bookings (new)

## Epic List

### Epic 1: Trust-Based Payment System
Customers are protected from fraud through progressive trust tiers. New customers (Tier 1) use non-reversible payment methods (Cash, CashApp, Zelle), earning card access after a configurable number of clean transactions. Admins configure tier thresholds and manually promote/demote tiers. All financial mutations generate immutable audit entries.
**FRs:** FR13, FR14, FR15, FR16, FR17, FR25, FR34, FR73
**Integration FRs:** FR48, FR49, FR51, FR55 (existing, verify trust tier initialization and payment filtering)
**Dependencies:** None (blocks Epic 3)
**NFR focus:** NFR12 (zero bypass), NFR14 (immutable audit), NFR20 (no bank details stored)

### Epic 2: Dynamic Pricing & Storm Mode
Pricing automatically adjusts by time-of-day via configurable time-block windows (Standard, After-Hours, Emergency). Customers see transparent multiplied pricing before confirming bookings. Admins configure pricing windows, multiplier percentages, activate Storm Mode with pre-built templates (Ice Storm, Falcons Game, Holiday Weekend), and override pricing on individual bookings.
**FRs:** FR9, FR10, FR23, FR75, FR76, FR77, FR83
**Dependencies:** None (enables Epic 4)
**Architecture:** time_block_configs table with Storm Mode templates as high-priority rows, centralized pricing engine, basis-point integer math

### Epic 3: Payment Operations & Tiered Commission
Admins efficiently confirm manual payment receipts (CashApp, Zelle, Cash), process provider payouts individually or in batches with service-category-specific commission rates, generate customer payment receipts via email, and handle partial/full refunds with corresponding payout adjustments. Providers view their commission tier and how service category affects their take-home.
**FRs:** FR18, FR19, FR20, FR21, FR22, FR43, FR74
**Integration FRs:** FR32, FR39 (existing, verify completion notifications and commission-adjusted provider notifications)
**Dependencies:** Epic 1 (Trust Tier enforcement on payment creation paths)
**Architecture:** Extended payments routes, payout calculator with tiered commission

### Epic 4: Enhanced Booking Experience
Customers book both emergency and scheduled services through a unified flow with mode toggle, see transparent pricing with time-block multipliers before confirming, and select from tiered diagnostic products (Basic, Standard, Premium) for inspection bookings. GPS auto-detection with manual override. Auto-dispatch with cascade failover. Full booking lifecycle including real-time tracking and notifications.
**FRs:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR11, FR12, FR64, FR65
**Integration FRs:** FR26, FR27, FR28, FR29 (Story 4.5), FR30, FR31, FR40, FR41, FR50, FR52 (Story 4.6) — existing, verify booking lifecycle integration
**Dependencies:** Epic 2 (pricing engine for price calculation)
**Note:** FR1-FR7, FR11-FR12 partially built. Epic adds mode toggle, pricing display, diagnostic product selection, and verifies full booking lifecycle. Story 4.4 (dispatch/location), Story 4.5 (tracking), Story 4.6 (lifecycle verification).

### Epic 5: Financial Reporting & Analytics
Admins monitor business performance with revenue analytics broken down by source (B2B/B2C), service category, payment method, and time-block tier. Comprehensive admin dashboard with pending payments, payout queue, and booking overview. Providers view detailed earnings breakdowns (per-job, daily, weekly, monthly).
**FRs:** FR24, FR42, FR72, FR82
**Integration FRs:** FR78, FR79, FR81 (existing, verify admin booking management and system health)
**Dependencies:** Epic 3 (payment data for meaningful reporting)
**Architecture:** financial-reports route, Recharts dashboard, real-time PostgreSQL aggregation

### Epic 6: Vehicle Observation & Follow-Up Pipeline
Providers document vehicle issues via structured observation checklists during any service type. Pre-service photos captured for documentation. System triggers follow-up notifications to customers based on observations. Admins configure per-service-type checklist templates. Bridges Front Door 1 (emergency) to Front Door 2 (diagnostics).
**FRs:** FR44, FR45, FR70, FR71, FR80
**Integration FRs:** FR35, FR36, FR37, FR38, FR46 (existing, verify provider onboarding and operations)
**Dependencies:** Independent
**Architecture:** observations table with JSONB items, checklistConfig on services table, follow-up notification pipeline

### Epic 7: Referral Growth Engine
Automated post-service referral SMS sent to customers within configurable time after completion. Customers view and share unique referral links, earn and redeem referral credits on future bookings. Providers can refer other providers and track referral status. Platform grows organically through word-of-mouth.
**FRs:** FR33, FR47, FR53, FR54
**Dependencies:** Independent
**Architecture:** referrals table, referral-credits lib, Twilio SMS integration, credit amount constant in lib/constants.ts

### Epic 8: Branded Vehicle Inspection Reports
Providers submit structured inspection findings including OBD2 data, photos, and measurements. System generates branded PDF inspection reports. Customers receive professional reports via email within configurable time after completion. Pre-service confirmation sent with inspector name and arrival time.
**FRs:** FR66, FR67, FR68, FR69
**Dependencies:** Independent
**Architecture:** inspection_reports table, @react-pdf/renderer, email delivery

### Epic 9: B2B Account Management
B2B businesses have managed accounts with company profiles, configurable contracts (retainer amounts, per-job rates, included services), consolidated billing with monthly itemized invoices, invoice status tracking, email notifications to billing contacts, and resident notification for dispatched services. **Phase 2 — architecture defined now, build later.**
**FRs:** FR56, FR57, FR58, FR59, FR60, FR61, FR62, FR63
**Dependencies:** Deferred to Phase 2
**Note:** Architecture defined now, build later. Uses existing tenantId pattern.

## Epic 1: Trust-Based Payment System

Customers are protected from fraud through progressive trust tiers. New customers (Tier 1) use non-reversible payment methods (Cash, CashApp, Zelle), earning card access after a configurable number of clean transactions. Admins configure tier thresholds and manually promote/demote tiers. All financial mutations generate immutable audit entries.

### Story 1.1: Trust Tier Data Model & Promotion Engine

As an admin,
I want the system to track customer trust tiers and automatically promote customers after clean transactions,
So that we have a data-driven fraud prevention system.

**FRs:** FR13, FR14, FR25 | **NFRs:** NFR14 (immutable audit)

**Acceptance Criteria:**

**Given** the users table exists
**When** the migration runs
**Then** `trustTier` (integer, default 1) and `cleanTransactionCount` (integer, default 0) columns are added to users
**And** existing users receive default values (Tier 1, count 0)

**Given** a Tier 1 customer completes a transaction without dispute
**When** the transaction is confirmed
**Then** their `cleanTransactionCount` increments by 1
**And** if the count meets the configurable threshold, `trustTier` is promoted to 2

**Given** the trust-tier promotion logic exists in `server/api/lib/trust-tier.ts`
**When** a tier change occurs (auto-promotion or admin override)
**Then** an audit log entry is created with action, userId, previousTier, newTier, and reason
**And** the audit entry is immutable — no update or delete operations permitted (NFR14)

### Story 1.2: Payment Method Enforcement Middleware

As a platform operator,
I want Tier 1 customers to be blocked from using card payments at the API level,
So that chargebacks from unverified customers are eliminated with zero bypass paths.

**FRs:** FR13, FR17 | **NFRs:** NFR12 (zero bypass paths)

**Acceptance Criteria:**

**Given** a Tier 1 customer attempts to create a payment with method "stripe"
**When** the request hits the `validatePaymentMethod` middleware
**Then** the request is rejected with 400 and message "Trust Tier 1 users cannot use card payments"
**And** an audit entry is logged with action `trust_tier.bypass_attempt`

**Given** a Tier 2 customer attempts to create a payment with method "stripe"
**When** the request hits the `validatePaymentMethod` middleware
**Then** the request proceeds normally

**Given** a Tier 1 customer attempts to create a payment with method "cash", "cashapp", or "zelle"
**When** the request hits the middleware
**Then** the request proceeds normally

**Given** a booking creation request includes a payment method
**When** the Zod schema validates the request
**Then** payment method eligibility is validated against the user's Trust Tier (second enforcement layer)

### Story 1.3: Admin Trust Tier Configuration & Management

As an admin,
I want to configure trust tier thresholds and manually promote or demote customers,
So that I can manage fraud prevention rules and handle edge cases.

**FRs:** FR16, FR73 | **NFRs:** NFR17 (admin RBAC)

**Acceptance Criteria:**

**Given** I am an authenticated admin
**When** I navigate to the Trust Tier admin page
**Then** I see a table of customers with their current tier, clean transaction count, and payment method eligibility

**Given** I am viewing a customer's tier information
**When** I click promote or demote
**Then** the customer's tier is updated immediately
**And** an audit log entry is created with action `trust_tier.admin_override`

**Given** I am on the Trust Tier configuration page
**When** I update the clean transaction threshold
**Then** the new threshold applies to all future tier promotions
**And** existing Tier 1 customers who already meet the new threshold are NOT auto-promoted (manual review required)

**Given** a non-admin user
**When** they attempt to access `/api/admin/trust-tier`
**Then** they receive a 403 Forbidden response

### Story 1.4: Customer Trust Tier Visibility, Notifications & Account Integration

As a customer,
I want to see my trust tier progress and available payment methods,
So that I understand how to unlock card payments.

**FRs:** FR15, FR34 | **NFRs:** NFR39 (WCAG 2.1 AA), NFR43 (44x44px touch targets)
**Integration FRs:** FR48, FR49, FR51, FR55

**Acceptance Criteria:**

**Given** I am a Tier 1 customer
**When** I view the payment step during booking
**Then** I see only Cash, CashApp, and Zelle as available payment methods
**And** I see a progress indicator showing X/N clean transactions toward card access

**Given** I am a Tier 2 customer
**When** I view the payment step during booking
**Then** I see all payment methods including credit card

**Given** my clean transaction count reaches the promotion threshold
**When** my tier is promoted to Tier 2
**Then** I receive an SMS and email notification that card payments are now unlocked
**And** the SMS includes delivery status tracking (NFR49)
**And** the email includes an unsubscribe link (NFR50)
**And** an audit log entry is created for the tier change

**Integration Verification:**

**Given** a new customer completes their first booking as a guest
**When** they create an account
**Then** the account is initialized with trustTier = 1, cleanTransactionCount = 0, and a unique referralCode (FR48)

**Given** a returning customer
**When** they authenticate
**Then** Google OAuth and email/password credentials both work correctly (FR49)
**And** session expires after 24 hours of inactivity (NFR15)

**Given** a customer views their payment methods page
**When** they manage payment methods
**Then** available methods are filtered by their current Trust Tier (FR51)

**Given** a user holds both customer and provider roles
**When** they switch between roles
**Then** the UI switches context based on their active role on a single account (FR55)

## Epic 2: Dynamic Pricing & Storm Mode

Pricing automatically adjusts by time-of-day via configurable time-block windows (Standard, After-Hours, Emergency). Customers see transparent multiplied pricing before confirming bookings. Admins configure pricing windows, multiplier percentages, activate Storm Mode with pre-built templates (Ice Storm, Falcons Game, Holiday Weekend), and override pricing on individual bookings.

### Story 2.1: Time-Block Pricing Schema & Engine

As a platform operator,
I want booking prices to automatically adjust based on time-of-day,
So that after-hours and emergency pricing reflects the premium service value.

**FRs:** FR10, FR75 | **NFRs:** NFR2 (API < 340ms p95)

**Acceptance Criteria:**

**Given** the `time_block_configs` table does not exist
**When** the migration and seed run
**Then** the table is created with columns: id, name, startHour, endHour, multiplier (basis points), isActive, priority, createdAt, updatedAt
**And** three default time-block rows are seeded: Standard (6-18, 10000bp, priority 1), After-Hours (18-6, 12500bp, priority 1), Emergency (Storm Mode, 15000bp, priority 1)
**And** three Storm Mode template rows are seeded as inactive with high priority: "Ice Storm" (15000bp, priority 100), "Falcons Game" (13000bp, priority 100), "Holiday Weekend" (12000bp, priority 100)

**Given** a booking is created at 9:00 AM
**When** `calculateBookingPrice()` runs in `server/api/lib/pricing-engine.ts`
**Then** the Standard multiplier (10000bp = 1.0x) is applied
**And** the response includes basePrice, multiplier, blockName, and finalPrice (all in cents/basis points)

**Given** a booking is created at 10:00 PM
**When** `calculateBookingPrice()` runs
**Then** the After-Hours multiplier (12500bp = 1.25x) is applied
**And** `finalPrice = Math.round(basePrice * multiplier / 10000)`

### Story 2.2: Storm Mode Activation & Templates

As an admin,
I want to activate Storm Mode with pre-built surge templates during severe weather or events,
So that pricing reflects extreme demand conditions and providers are incentivized to work.

**FRs:** FR23, FR76, FR77

**Acceptance Criteria:**

**Given** I am an authenticated admin
**When** I activate Storm Mode with template "Ice Storm"
**Then** the selected template row in `time_block_configs` is set to `isActive: true`
**And** its high priority (100) causes it to override all regular time-block pricing
**And** an audit entry is logged with `pricing.toggle_storm_mode`

**Given** Storm Mode is active
**When** a booking is created at any time of day
**Then** the Storm Mode template multiplier is applied instead of the time-block multiplier (highest priority wins)

**Given** I deactivate Storm Mode
**When** I toggle Storm Mode off
**Then** the active template row is set to `isActive: false`
**And** normal time-block pricing resumes for the next booking

**Given** I am on the pricing admin page
**When** I view Storm Mode templates
**Then** I see pre-built options: Ice Storm, Falcons Game, Holiday Weekend
**And** each template displays its configurable multiplier
**And** I can edit the multiplier for any template

### Story 2.3: Admin Pricing Configuration & Booking Override

As an admin,
I want to configure time-block pricing windows and override pricing on individual bookings,
So that I can adjust rates for market conditions and handle B2B custom pricing or goodwill credits.

**FRs:** FR75, FR83

**Acceptance Criteria:**

**Given** the existing bookings table needs price override support
**When** the migration runs
**Then** `priceOverrideCents` (integer, nullable) and `priceOverrideReason` (text, nullable) columns are added to the bookings table
**And** existing bookings retain null values (no override)

**Given** I am on the admin pricing configuration page
**When** I update a time-block window's hours or multiplier
**Then** the changes take effect immediately for new bookings
**And** an audit entry is logged with `pricing.update_block`

**Given** I am viewing a specific booking
**When** I override its price with a custom amount and reason
**Then** `priceOverrideCents` and `priceOverrideReason` are set on the booking record
**And** the override is audit-logged with the original and new price
**And** the provider payout recalculates based on the new amount

**Given** a customer is on the booking confirmation page
**When** they review the price before confirming
**Then** they see the base price, time-block multiplier name, and final price transparently displayed

## Epic 3: Payment Operations & Tiered Commission

Admins efficiently confirm manual payment receipts (CashApp, Zelle, Cash), process provider payouts individually or in batches with service-category-specific commission rates, generate customer payment receipts via email, and handle partial/full refunds with corresponding payout adjustments. Providers view their commission tier and how service category affects their take-home.

### Story 3.1: Tiered Commission Configuration & Calculation

As an admin,
I want to configure commission rates per service category so providers receive fair, service-specific compensation,
So that high-complexity services have different commission structures than basic services.

**FRs:** FR19, FR43, FR74

**Acceptance Criteria:**

**Given** the existing services table needs commission rate support
**When** the migration runs
**Then** a `commissionRate` (integer, basis points, default 2500 = 25%) column is added to the services table
**And** existing service categories receive default commission rates

**Given** I am on the admin commission configuration page
**When** I set commission rates per service category (e.g., roadside: 2500bp = 25%, diagnostics: 2000bp = 20%)
**Then** the rates are stored on the services table and apply to all new bookings for that service category

**Given** a booking for a "jump start" service is completed
**When** the payout is calculated via `payout-calculator.ts`
**Then** the roadside commission rate is applied: `providerPayout = bookingPrice - Math.round(bookingPrice * commissionRate / 10000)`

**Given** a booking for a "pre-purchase inspection" is completed
**When** the payout is calculated
**Then** the diagnostics commission rate is applied (different from roadside)
**And** the provider can view their commission tier and per-service-category payout percentage

### Story 3.2: Manual Payment Confirmation & Receipt Generation

As an admin,
I want to confirm manual payment receipts (CashApp, Zelle, Cash) and automatically send customer receipts,
So that the payment lifecycle completes reliably and customers have proof of payment.

**FRs:** FR18, FR21 | **NFRs:** NFR50 (email CAN-SPAM compliance)

**Acceptance Criteria:**

**Given** a completed booking with payment method "cashapp"
**When** I confirm payment receipt in the admin dashboard
**Then** the booking payment status updates to "paid"
**And** a payment receipt email is generated and sent to the customer
**And** an audit entry is logged with `payment.confirm`

**Given** a completed booking with payment method "cash"
**When** I confirm the cash payment
**Then** the same confirmation and receipt flow executes

**Given** I confirm a payment
**When** the receipt email is sent
**Then** it includes: booking ID, service type, amount paid, payment method, date, and provider name
**And** the email includes an unsubscribe link (NFR50)

### Story 3.3: Batch Payouts, Refund Processing & Payment Lifecycle Integration

As an admin,
I want to process provider payouts individually or in batches and handle refunds with payout adjustments,
So that provider compensation is timely and dispute resolution adjusts financial records correctly.

**FRs:** FR20, FR22 | **NFRs:** NFR34 (zero double-charge)
**Integration FRs:** FR32, FR39

**Acceptance Criteria:**

**Given** multiple confirmed bookings with pending provider payouts
**When** I select payouts and click "Process Batch"
**Then** all selected payouts are marked as paid
**And** each payout generates an audit entry with `payout.mark_paid`
**And** idempotency keys prevent double-processing (NFR34)

**Given** a single confirmed booking with a pending payout
**When** I process the individual payout
**Then** the payout is marked as paid with the commission-adjusted amount

**Given** a customer dispute on a completed booking
**When** I initiate a partial refund (e.g., 50%)
**Then** the customer refund amount is recorded
**And** the provider payout is adjusted proportionally
**And** audit entries are logged for both `payment.refund` and payout adjustment

**Given** I initiate a full refund
**When** the refund is processed
**Then** the full booking amount is refunded to the customer
**And** the provider payout is reversed entirely

**Given** I initiate a refund on a booking where the provider payout has already been processed
**When** the refund is confirmed
**Then** a negative payout record is created with type `clawback`, linking to the original payout and refund records
**And** the negative amount is deducted from the provider's next batch payout calculation
**And** the admin dashboard flags the outstanding provider balance
**And** audit entries are logged for both `payment.refund` and `payout.clawback`

**Integration Verification:**

**Given** a booking is completed
**When** the service completion event fires
**Then** a completion notification (SMS + email) is sent to the customer with booking summary and amount paid (FR32)

**Given** a provider receives a job notification
**When** the notification displays
**Then** it includes service type, distance, price (with time-block multiplier), and their commission-adjusted payout amount (FR39)

## Epic 4: Enhanced Booking Experience

Customers book both emergency and scheduled services through a unified flow with mode toggle, see transparent pricing with time-block multipliers before confirming, and select from tiered diagnostic products (Basic, Standard, Premium) for inspection bookings. GPS auto-detection with manual override. Auto-dispatch with cascade failover. Full booking lifecycle including real-time tracking and notifications.

### Story 4.1: Booking Mode Toggle (Immediate & Scheduled)

As a customer,
I want to choose between an immediate emergency booking and a scheduled appointment in the same booking flow,
So that I can get help now or plan a service for later.

**FRs:** FR1, FR2 | **NFRs:** NFR43 (44x44px touch targets), NFR5 (CLS < 0.1)

**Acceptance Criteria:**

**Given** I am on the booking page
**When** I see the booking form
**Then** I see a mode toggle with "Now" (immediate) and "Schedule" options
**And** touch targets are minimum 44x44px (NFR43)

**Given** I select "Now" mode
**When** I proceed with the booking
**Then** `scheduledAt` is null in the booking record
**And** auto-dispatch begins immediately upon confirmation

**Given** I select "Schedule" mode
**When** I proceed with the booking
**Then** a date/time picker appears for selecting appointment time
**And** `scheduledAt` is set to the chosen timestamp
**And** the booking is created but dispatch is deferred until the scheduled time

**Given** I toggle between modes
**When** I switch from "Schedule" back to "Now"
**Then** the date/time picker disappears and the form resets to immediate mode
**And** no layout shift occurs (NFR5)

### Story 4.2: Transparent Pricing Display

As a customer,
I want to see the transparent price including any time-block multipliers before confirming my booking,
So that I know exactly what I'm paying with no surprises.

**FRs:** FR9 | **NFRs:** NFR43 (touch targets)

**Acceptance Criteria:**

**Given** I am booking an emergency roadside service at 10 PM
**When** the pricing loads
**Then** I see the base price, "After-Hours" label, 1.25x multiplier, and the final calculated price

**Given** Storm Mode is active
**When** I view booking pricing
**Then** I see the Storm Mode label and its multiplier applied instead of the time-block multiplier

**Given** the pricing engine returns a price
**When** it is displayed to me
**Then** the price is formatted using `formatPrice()` and matches the server-calculated amount exactly
**And** all price components (base, multiplier, final) are visible

### Story 4.3: Diagnostic Product Selection

As a customer,
I want to select from tiered diagnostic products (Basic, Standard, Premium) with clear features and pricing,
So that I can choose the right inspection level for my vehicle purchase decision.

**FRs:** FR8, FR64, FR65

**Acceptance Criteria:**

**Given** the services table contains diagnostic product records
**When** the seed data runs
**Then** three diagnostic service records exist: "Basic Inspection", "Standard Inspection", "Premium Inspection"
**And** each record has a base price (cents), description of included inspection items, and commission rate

**Given** I am booking a pre-purchase vehicle inspection
**When** I reach the product selection step
**Then** I see tiered options: Basic, Standard, Premium with clearly displayed features and pricing for each
**And** I can specify location, date, and time for the inspection

**Given** I select a diagnostic product tier
**When** I proceed to confirmation
**Then** the selected tier's base price is shown with any applicable time-block multiplier
**And** the total price matches the server-calculated amount

### Story 4.4: Location Detection & Provider Dispatch

As a customer,
I want my location auto-detected and the nearest provider dispatched automatically,
So that I get help as quickly as possible without manual coordination.

**FRs:** FR3, FR4, FR5, FR6, FR7, FR11, FR12 | **NFRs:** NFR3 (dispatch < 5s), NFR36 (failover < 2min)

**Acceptance Criteria:**

**Given** I open the booking form
**When** GPS is available
**Then** my location is auto-detected and pre-filled in the location field

**Given** GPS is unavailable or inaccurate
**When** I need to specify my location
**Then** I can manually enter or override my location

**Given** I confirm an immediate booking
**When** auto-dispatch runs
**Then** the nearest available provider matching the service type is notified
**And** the booking-to-dispatch cycle completes in < 5 seconds (NFR3)

**Given** the first provider declines or times out
**When** cascade dispatch triggers
**Then** the next nearest provider is notified within the configurable timeout (NFR36)
**And** the search radius expands if no provider is available within the default range

**Given** I need to cancel
**When** no provider has been dispatched yet
**Then** I can cancel the booking without penalty

**Given** the booking is for a B2B or subscription account
**When** dispatch runs
**Then** priority dispatch logic is applied (B2B bookings are matched before B2C bookings in the same time window)

### Story 4.5: Real-Time Provider Tracking

As a customer,
I want to track the dispatched provider's location in real-time on a live map,
So that I know exactly when help will arrive.

**Integration FRs:** FR26, FR27, FR28, FR29 | **NFRs:** NFR9 (GPS < 500ms), NFR19 (no background tracking), NFR8 (WebSocket reconnect < 3s)

**Acceptance Criteria:**

**Given** I have an active booking with a dispatched provider
**When** the provider's GPS updates
**Then** I see real-time location updates on the live map with < 500ms latency (NFR9, FR26)
**And** I can view the provider's name, photo, rating, and ETA (FR27)

**Given** the provider is en route
**When** GPS position updates are broadcast
**Then** broadcasts only occur during active bookings — no background tracking, no retention beyond booking lifecycle (NFR19, FR28)

**Given** the WebSocket connection drops (mobile network switch)
**When** the connection is re-established
**Then** reconnection completes in < 3 seconds with exponential backoff and jitter (NFR8)
**And** the provider's current position is immediately displayed

**Given** the provider's ETA exceeds the configurable threshold
**When** the delay is detected
**Then** an automated delay notification is sent to the customer (FR29)

### Story 4.6: Booking Lifecycle & Notification Verification

As a customer,
I want booking confirmation, provider assignment, and status update notifications throughout the booking lifecycle,
So that I'm always informed about the status of my service.

**Integration FRs:** FR30, FR31, FR40, FR41, FR50, FR52 | **NFRs:** NFR49 (SMS delivery tracking), NFR50 (email CAN-SPAM)

**Acceptance Criteria:**

**Given** I create a booking
**When** the booking is confirmed
**Then** booking confirmation notifications are sent via SMS and email (FR30)
**And** SMS delivery status is tracked (NFR49)
**And** email includes an unsubscribe link (NFR50)

**Given** a provider is assigned to my booking
**When** the assignment is made
**Then** provider assignment notifications are sent to both customer and provider (FR31)

**Given** a provider receives a job notification
**When** they respond
**Then** they can accept or decline within the configurable timeout (FR40)
**And** after accepting, they can update status through: en route → arrived → in progress → completed (FR41)

**Given** I have completed bookings
**When** I view my booking history
**Then** I see my booking history and service records (FR50)
**And** I can rate and review providers after service completion (FR52)

## Epic 5: Financial Reporting & Analytics

Admins monitor business performance with revenue analytics broken down by source (B2B/B2C), service category, payment method, and time-block tier. Comprehensive admin dashboard with pending payments, payout queue, and booking overview. Providers view detailed earnings breakdowns (per-job, daily, weekly, monthly). Admin booking management and system health monitoring.

### Story 5.1: Admin Financial Dashboard & Revenue Analytics

As an admin,
I want a comprehensive dashboard showing revenue analytics broken down by source, service category, payment method, and time-block tier,
So that I can answer "is the business working?" at a glance.

**FRs:** FR24, FR72 | **NFRs:** NFR24 (query < 100ms)

**Acceptance Criteria:**

**Given** I am an authenticated admin
**When** I navigate to the financial reports page
**Then** I see revenue totals with filters for date range, source (B2B/B2C), service category, payment method, and time-block tier
**And** charts render using Recharts showing revenue trends over time

**Given** I select a date range filter
**When** the dashboard updates
**Then** all metrics recalculate for the selected period via real-time PostgreSQL aggregation

**Given** the dashboard displays financial data
**When** amounts are shown
**Then** all values are returned from the API in cents and formatted on the client using `formatPrice()`

**Given** I view the dashboard
**When** I see the overview section
**Then** it includes pending payments count, payout queue total, active bookings, and provider availability summary

### Story 5.2: Provider Earnings View

As a provider,
I want to view my detailed earnings breakdown (per-job, daily, weekly, monthly),
So that I can track my income and plan financially.

**FRs:** FR42

**Acceptance Criteria:**

**Given** I am an authenticated provider
**When** I navigate to my earnings page
**Then** I see per-job earnings with service type, booking amount, commission deducted, and my payout
**And** I see aggregated totals for daily, weekly, and monthly periods

**Given** I select a different time period
**When** the earnings view updates
**Then** the totals recalculate for the selected period

**Given** the earnings page displays amounts
**When** values are shown
**Then** all values are returned from the API in cents and formatted on the client using `formatPrice()`

### Story 5.3: Admin 1099 Export & Operations Management

As an admin,
I want to export provider earnings in 1099-ready format and manage all bookings from the admin dashboard,
So that I can fulfill tax reporting obligations and efficiently oversee operations.

**FRs:** FR82 | **NFRs:** NFR13 (SSN/EIN encryption)
**Integration FRs:** FR78, FR79, FR81

**Acceptance Criteria:**

**Given** the existing users table needs tax identification support for providers
**When** the migration runs
**Then** a `taxId` (text, nullable) column is added to the users table
**And** the column value is encrypted at rest using AES-256 or equivalent (NFR13)
**And** only users with role "provider" will have this field populated

**Given** I am an authenticated admin at year-end
**When** I click "Export 1099 Data"
**Then** the system generates a CSV download with columns: Provider Name, Tax ID (decrypted for export, encrypted at rest per NFR13), Total Earnings (cents), Calendar Year
**And** the export filters by tax year and includes only providers with earnings above the IRS 1099-NEC reporting threshold ($600)

**Integration Verification:**

**Given** I am on the admin dashboard
**When** I navigate to the bookings section
**Then** I can view and manage all active, completed, and cancelled bookings (FR78)
**And** I can add internal notes to booking records that are not visible to customers (FR79)

**Given** I am on the admin dashboard
**When** I view the system health widget
**Then** I see WebSocket connection status, deployment health, and database connectivity (FR81)
**And** the health endpoint responds within 5 seconds (NFR37)

## Epic 6: Vehicle Observation & Follow-Up Pipeline

Providers document vehicle issues via structured observation checklists during any service type (not just diagnostics). Pre-service photos captured for documentation. System triggers follow-up notifications to customers based on observations. Admins configure per-service-type checklist templates. Bridges Front Door 1 (emergency) to Front Door 2 (diagnostics).

### Story 6.1: Observation Schema, Checklist Configuration & Provider Submission

As a provider,
I want to submit structured vehicle observation notes and photos during or after any service using a configured checklist,
So that vehicle issues are documented for customer follow-up and diagnostic upsell.

**FRs:** FR44, FR45, FR70, FR80 | **NFRs:** NFR46 (schema validation)

**Acceptance Criteria:**

**Given** the `observations` table does not exist
**When** the migration runs
**Then** the table is created with: id, bookingId (FK), providerId, items (JSONB typed as `ObservationItem[]`), followUpSent (boolean, default false), createdAt

**Given** the existing services table needs checklist configuration support
**When** the migration runs
**Then** a `checklistConfig` (JSONB, nullable) column is added to the services table
**And** each service category is seeded with default checklist items (e.g., "Jump Start" → Battery, Terminals, Alternator; "Tire Change" → Tread Depth, Pressure, Spare Condition)

**Given** an admin configures checklist items for a service type
**When** the configuration is saved via the API
**Then** the `checklistConfig` JSONB on the service record is updated
**And** providers see these required items when submitting observations for that service type

**Given** I am on an active or completed job
**When** I open the observation form
**Then** I see the structured checklist from the service type's `checklistConfig`, organized by category
**And** for each item I can add description, severity (low/medium/high), and optional photo

**Given** I submit observations for a booking
**When** the POST request completes
**Then** the observation record is saved with all items
**And** an audit entry is logged with `observation.submit`

**Given** I have already submitted observations for a booking
**When** I try to submit again
**Then** I receive a 409 error: "Observation already submitted for this booking"

**Given** I am documenting a service
**When** I upload pre-service photos
**Then** the photos are attached to the booking for documentation purposes

### Story 6.2: Customer Follow-Up Notifications & Provider Operations Integration

As an admin,
I want the system to automatically notify customers about vehicle issues found during service, and for the provider onboarding and operations pipeline to work correctly alongside observations,
So that customers receive proactive maintenance recommendations and providers have a seamless workflow.

**FRs:** FR71 | **NFRs:** NFR49 (SMS delivery tracking), NFR50 (email CAN-SPAM)
**Integration FRs:** FR35, FR36, FR37, FR38, FR46

**Acceptance Criteria:**

**Given** a provider submits observations with medium or high severity items
**When** the observation is saved
**Then** the system sends a follow-up SMS and email to the customer (e.g., "Your provider noticed your battery may need replacement — book a diagnostic inspection")
**And** the SMS includes delivery status tracking (NFR49)
**And** the email includes an unsubscribe link and booking link for diagnostic services (NFR50)
**And** `followUpSent` is set to true on the observation record
**And** an audit entry is logged with `observation.follow_up_sent`

**Given** a provider submits observations with only low severity items
**When** the observation is saved
**Then** no follow-up notification is sent (low severity = informational only)

**Integration Verification:**

**Given** a prospective provider
**When** they submit an application with personal info, vehicle details, insurance, service area, and hours
**Then** the application is received and admin can review, approve, deny, or request resubmission (FR35, FR36)

**Given** an approved provider
**When** they configure their profile
**Then** they can toggle availability online/offline to enter/exit the dispatch pool (FR37)
**And** they can configure their service area by zone (FR38)
**And** they can view their rating and review history (FR46)

## Epic 7: Referral Growth Engine

Automated post-service referral SMS sent to customers within configurable time after completion. Customers view and share unique referral links, earn and redeem referral credits on future bookings. Providers can refer other providers and track referral status. Platform grows organically through word-of-mouth.

### Story 7.1: Referral Schema, Credit Configuration & Post-Service SMS

As a platform operator,
I want customers to automatically receive a referral link via SMS after service completion,
So that every completed booking drives organic growth.

**FRs:** FR33, FR53 | **NFRs:** NFR49 (SMS delivery tracking)

**Acceptance Criteria:**

**Given** the `referrals` table does not exist
**When** the migration runs
**Then** the table is created with: id, referrerId (FK users), refereeId (FK users, nullable), bookingId (FK bookings, nullable), creditAmount (int, cents), status (pending/credited/expired), createdAt
**And** a `referralCode` column (text, unique) is added to the users table with auto-generated short UUID

**Given** referral credit amounts need to be configurable
**When** the implementation is set up
**Then** a `REFERRAL_CREDIT_AMOUNT_CENTS` constant is defined in `lib/constants.ts` (default: 1000 = $10.00)
**And** both referrer and referee receive this amount when a referral completes

**Given** a booking is completed and payment confirmed
**When** a configurable time period elapses (e.g., 30 minutes)
**Then** the customer receives an SMS with their unique referral link
**And** SMS delivery status is tracked (NFR49)
**And** an audit entry is logged with `referral.create`

**Note:** Referral codes are generated during account creation (see Story 1.4, FR48). This story assumes the `referralCode` column already exists on users.

### Story 7.2: Referral Tracking, Credits & Provider Referrals

As a customer,
I want to view my referral link, track who I've referred, and earn credits on future bookings,
So that I'm rewarded for growing the platform.

**FRs:** FR47, FR54

**Acceptance Criteria:**

**Given** I am an authenticated customer
**When** I navigate to my referral page
**Then** I see my unique referral link/code, number of referrals, and credit balance

**Given** a new customer signs up using my referral code
**When** they complete their first booking
**Then** both I (referrer) and the new customer (referee) receive referral credits of `REFERRAL_CREDIT_AMOUNT_CENTS`
**And** the referral record status updates to "credited"
**And** a notification is sent to me confirming the credit

**Given** I have referral credits available
**When** I create a new booking
**Then** I can apply my credits as a discount on the booking total

**Given** I am a provider
**When** I refer another provider
**Then** I can track the referral status (pending, credited, expired)
**And** referral credits are applied when the referred provider completes their first job

## Epic 8: Branded Vehicle Inspection Reports

Providers submit structured inspection findings including OBD2 data, photos, and measurements. System generates branded PDF inspection reports. Customers receive professional reports via email within configurable time after completion. Pre-service confirmation sent with inspector name and arrival time.

### Story 8.1: Inspection Report Schema & Provider Submission

As a provider,
I want to capture and submit structured inspection findings including OBD2 data, photos, and measurements,
So that the data is organized for professional report generation.

**FRs:** FR66, FR67 | **NFRs:** NFR46 (schema validation)

**Acceptance Criteria:**

**Given** the `inspection_reports` table does not exist
**When** the migration runs
**Then** the table is created with: id, bookingId (FK), providerId, findings (JSONB — structured inspection data), reportUrl (text, nullable), emailedAt (timestamp, nullable), createdAt

**Given** I am assigned to a diagnostic inspection booking
**When** I open the inspection form
**Then** I see structured fields for OBD2 codes, component measurements, photo uploads, and condition ratings

**Given** I complete the inspection
**When** I submit findings
**Then** the inspection report record is saved with structured JSONB data
**And** an HTML preview is immediately available for the customer
**And** an audit entry is logged with `inspection.generate`

**Given** the customer receives a pre-service confirmation
**When** a provider is assigned to their inspection booking
**Then** the confirmation includes the inspector's name and estimated arrival time

### Story 8.2: Branded PDF Generation & Email Delivery

As a customer,
I want to receive a professional branded PDF inspection report via email,
So that I have a shareable document for pre-purchase vehicle decisions.

**FRs:** FR68, FR69 | **NFRs:** NFR10 (PDF < 30s), NFR50 (email CAN-SPAM)

**Acceptance Criteria:**

**Given** an inspection report has been submitted
**When** I or the system requests the PDF
**Then** `@react-pdf/renderer` generates a branded PDF in `server/api/lib/pdf-generator.ts`
**And** the PDF includes RoadSide ATL branding, inspection date, vehicle details, all findings, photos, and provider name
**And** generation completes within 30 seconds (NFR10)

**Given** the PDF is generated
**When** the configurable email delay elapses
**Then** the report is emailed to the customer via Resend
**And** the email includes: inspection date, vehicle description, PDF attachment, and unsubscribe link (NFR50)
**And** `emailedAt` is set on the inspection report record
**And** an audit entry is logged with `inspection.email_sent`

**Given** the PDF generation fails
**When** the system encounters an error
**Then** the structured data remains available as an HTML fallback
**And** a 500 error is returned for the PDF endpoint specifically
**And** the HTML preview link is included in the customer email instead

## Epic 9: B2B Account Management

B2B businesses have managed accounts with company profiles, configurable contracts (retainer amounts, per-job rates, included services), consolidated billing with monthly itemized invoices, invoice status tracking, email notifications to billing contacts, and resident notification for dispatched services. **Phase 2 — architecture defined now, build later.**

### Story 9.1: B2B Account & Contract Management

As an admin,
I want to create and manage B2B business accounts with company profiles and configurable contracts,
So that dealerships and apartment complexes have structured service agreements.

**FRs:** FR56, FR57, FR58, FR59

**Acceptance Criteria:**

**Given** I am an authenticated admin
**When** I create a new B2B account
**Then** I can enter company name, billing address, contact person, email, phone, and payment terms
**And** the account is stored with a unique tenantId for booking isolation

**Given** I have a B2B account created
**When** I configure a contract
**Then** I can set retainer amounts, per-job rates, included service types, contract start date, and end date

**Given** a B2B account holder
**When** they request services on behalf of their residents or customers
**Then** the booking is tagged to the B2B account for consolidated billing
**And** residents/customers receive notification of the incoming dispatched service

### Story 9.2: B2B Invoicing & Billing

As an admin,
I want the system to generate monthly invoices for B2B accounts and track payment status,
So that B2B billing is automated and I can follow up on overdue payments.

**FRs:** FR60, FR61, FR62, FR63 | **NFRs:** NFR50 (email CAN-SPAM)

**Acceptance Criteria:**

**Given** a B2B account has completed bookings during the billing period
**When** the monthly invoice generation runs
**Then** an itemized invoice is created listing each booking with service type, date, and amount
**And** the invoice status is set to "draft"

**Given** I review a draft invoice
**When** I send it to the B2B account
**Then** the invoice status updates to "sent"
**And** an email notification is sent to the B2B billing contact with the invoice details and unsubscribe link (NFR50)

**Given** a B2B account pays their invoice
**When** I mark the invoice as paid
**Then** the status updates to "paid" with the payment date recorded

**Given** an invoice is past its payment terms
**When** the due date passes
**Then** the status updates to "overdue"
**And** the admin dashboard highlights overdue invoices for follow-up

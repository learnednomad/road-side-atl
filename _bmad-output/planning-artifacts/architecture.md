---
stepsCompleted: ['step-01-init', 'step-02-context', 'step-03-starter', 'step-04-decisions', 'step-05-patterns', 'step-06-structure', 'step-07-validation', 'step-08-complete']
status: 'extending-v2'
completedAt: '2026-02-12'
extensionStarted: '2026-03-03'
extensionFeature: 'Provider Onboarding'
extensionStepsCompleted: ['step-02-context', 'step-03-starter', 'step-04-decisions', 'step-05-patterns', 'step-06-structure', 'step-07-validation', 'step-08-complete']
extensionStatus: 'complete'
extensionCompletedAt: '2026-03-03'
extension2Started: '2026-04-07'
extension2Feature: 'Mobile Mechanics + Beta + Mobile Parity'
extension2StepsCompleted: ['context', 'decisions', 'patterns', 'structure', 'validation', 'complete']
extension2Status: 'complete'
extension2CompletedAt: '2026-04-07'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/prd-validation-report.md
  - _bmad-output/planning-artifacts/product-brief-road-side-atl-2026-02-11.md
  - _bmad-output/planning-artifacts/prd-provider-onboarding.md
  - _bmad-output/planning-artifacts/prd-provider-onboarding-validation-report.md
  - _bmad-output/project-context.md
  - docs/index.md
  - docs/project-overview.md
  - docs/project-context.md
  - docs/architecture.md
  - docs/data-models.md
  - docs/api-contracts.md
  - docs/source-tree-analysis.md
  - docs/component-inventory.md
  - docs/development-guide.md
  - docs/deployment-guide.md
workflowType: 'architecture'
project_name: 'road-side-atl'
user_name: 'Beel'
date: '2026-02-12'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
83 FRs across 8 capability areas. The highest-density areas are Payment & Financial Operations (13 FRs) and Provider Management (13 FRs), reflecting the platform's core value proposition: connecting payments to service delivery. The Trust Tier system (FR13-FR16) is the most architecturally significant feature — it introduces a new user state machine that gates payment method access and must have zero bypass paths.

**Non-Functional Requirements:**
50 NFRs across Performance (10), Security (10), Scalability (8), Reliability (10), Accessibility (7), Integration (5). The security NFRs are the most architecturally constraining — NFR12 (zero Trust Tier bypass), NFR14 (immutable audit logs), and NFR19 (GPS data lifecycle) all require defensive patterns baked into the data layer, not bolted on at the application layer.

**Scale & Complexity:**

- Primary domain: Full-stack web (SSR + real-time + REST API)
- Complexity level: High
- Existing architectural components: 14 tables, 15 route modules, 70+ endpoints, WebSocket server, 3 notification channels, 4 route groups
- New components needed: ~6-8 new tables, ~5 new route modules, ~30 new endpoints, PDF generation service

### Technical Constraints & Dependencies

**Locked technology choices (brownfield):**
- Next.js 16 App Router with standalone Docker output
- Hono API layer (all routes in `server/api/routes/`)
- Drizzle ORM with PostgreSQL 16
- NextAuth v5 beta (JWT strategy)
- Zod v4 (`import from "zod/v4"`)
- Tailwind CSS v4 (CSS-based config)
- WebSocket via `ws` library (custom server)
- Stripe, Twilio, Resend integrations

**Critical anti-patterns to preserve:**
- No API routes in `app/api/` — all through Hono
- No try-catch in route handlers — Hono handles errors
- No `getServerSession()` — use `auth()` from NextAuth v5
- Money always in cents, IDs always text UUIDs
- Manual `updatedAt` in every Drizzle update call
- Destructure `.returning()` — it returns an array

**Schema expansion constraints:**
- `tenantId` columns exist but not enforced — B2B isolation must use application-level filtering, not schema-level
- `providerId` on bookings is intentionally unlinked (no FK) — maintain this pattern
- New tables must follow existing patterns: text PKs, `createdAt`/`updatedAt` timestamps, barrel export via `db/schema/index.ts`

### Cross-Cutting Concerns Identified

1. **Trust Tier enforcement** — Touches user model, payment validation, booking creation, admin overrides. Must be enforced at the API layer (middleware or validator), not just UI. Zero bypass paths is a security NFR.

2. **Financial audit logging** — Every payment confirmation, payout, refund, Trust Tier change, and admin override must generate an immutable audit entry. Current `logAudit()` exists but needs extension for new financial operations.

3. **Time-block pricing** — Affects booking price calculation, admin configuration, customer-facing transparency, and financial reporting. Needs a centralized pricing engine, not scattered calculation logic.

4. **B2B account isolation** — B2B bookings, invoices, and contracts must be scoped to business accounts. Uses existing `tenantId` pattern but needs application-level enforcement (middleware or query filters).

5. **PDF generation** — Inspection reports require server-side PDF generation. Must run in Node.js context (not Edge, not client). `@react-pdf/renderer` is Node-only — cannot import in client components.

6. **Dual-role user support** — Users with both customer and provider roles. Session/JWT must carry role context. UI switches based on active role. Auth middleware must support role-specific access per route group.

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web application (SSR + real-time + REST API) — brownfield expansion project.

### Starter Options Considered

**Not applicable.** This is a brownfield project with 85% of the platform already built and deployed. All technology selections are locked:

| Decision | Choice | Status |
|---|---|---|
| Frontend framework | Next.js 16.1.6 (App Router) | Locked — deployed |
| API framework | Hono 4.11.7 | Locked — 70+ endpoints |
| ORM | Drizzle 0.45.1 | Locked — 14 tables |
| Database | PostgreSQL 16 | Locked — production data |
| Auth | NextAuth v5 beta | Locked — users active |
| Styling | Tailwind v4 + shadcn/ui | Locked — full UI built |
| Real-time | ws 8.19.0 | Locked — WebSocket running |
| Payments | Stripe 20.3.0 | Locked — processing payments |
| Deployment | Docker + Coolify | Locked — production |

### Selected Starter: Existing Codebase

**Rationale:** No initialization needed. The 9 MVP features extend the existing architecture — they add tables, routes, and components following established patterns.

### Architectural Decisions Already Established

**Language & Runtime:** TypeScript 5 strict mode, Node.js 20 Alpine, ES2017 target, bundler moduleResolution

**Styling Solution:** Tailwind CSS v4 (CSS-based config, `@import "tailwindcss"`), shadcn/ui components in `components/ui/`, oklch color space, `cn()` utility for conditional classes

**Build Tooling:** Next.js standalone output, Docker multi-stage (deps → builder → runner), `serverExternalPackages: ["postgres", "ws"]`

**Testing Framework:** None installed. If added: Vitest for unit/integration, Playwright for E2E. Test pyramid: Zod schema edge cases → Hono route integration → critical user flows.

**Code Organization:** Route groups `(marketing)`, `(admin)`, `(provider)`, `(dashboard)`, `(auth)`. API routes in `server/api/routes/`. Domain components in `components/{domain}/`. Schema per entity in `db/schema/`. Validators in `lib/validators.ts`. Constants in `lib/constants.ts`.

**Development Experience:** Next.js dev server with hot reload. No pre-commit hooks. ESLint flat config. No Prettier. Docker Compose for local PostgreSQL.

**Note:** The 9 MVP features follow the existing "Adding New Features Checklist" from the project context: new route → register in index.ts → new schema → export from index → new page in route group → new component in domain folder.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Trust Tier data model — columns on users table (trustTier + cleanTransactionCount)
2. Trust Tier zero-bypass enforcement — defense in depth (middleware + Zod validator)
3. Time-block pricing configuration — database table (time_block_configs), admin-configurable at runtime
4. PDF generation library — @react-pdf/renderer (Node-only, server API route)

**Important Decisions (Shape Architecture):**
5. Vehicle observation checklist — separate observations table (first-class entity for follow-up pipeline)
6. Referral tracking — referralCode on users + separate referrals table for lifecycle tracking
7. Financial reporting — real-time aggregation queries (adequate at Phase 1 volume)
8. New API route modules — 6 new modules following existing Hono pattern

**Deferred Decisions (Post-MVP):**
9. B2B account schema — Phase 2 (architecture designed now, build later)
10. Subscription billing architecture — Phase 2 (Stripe Subscriptions API, webhook handlers)
11. Pre-computed financial summaries — Phase 3+ (when query volume justifies materialized views)

### Data Architecture

**Trust Tier Storage (Decision 1.1)**
- Choice: Add columns to `users` table
- New columns: `trustTier` (integer, default 1), `cleanTransactionCount` (integer, default 0)
- Rationale: Tier is a user property, not a separate entity. Audit log captures tier changes with before/after state. Admin overrides update column directly.
- Affects: users schema, payment validation, booking creation, admin dashboard

**Time-Block Pricing (Decision 1.2)**
- Choice: Database table `time_block_configs`
- Schema: `id`, `name` (text), `startHour` (int, 0-23), `endHour` (int, 0-23), `multiplier` (int, basis points — 10000 = 1.0x), `isActive` (boolean), `priority` (int, for overlap resolution), `createdAt`, `updatedAt`
- Seeded defaults: Standard (6-18, 10000bp), After-Hours (18-6, 12500bp), Emergency (Storm Mode, 15000bp)
- Rationale: FR75 requires admin-configurable pricing. Must be runtime-editable without code deploy.
- Affects: booking price calculation, admin pricing page, financial reporting

**Vehicle Observations (Decision 1.3)**
- Choice: Separate `observations` table
- Schema: `id`, `bookingId` (FK bookings), `providerId` (text), `items` (JSONB — `{ category, description, severity, photoUrl? }[]`), `followUpSent` (boolean, default false), `createdAt`
- Rationale: Observations trigger follow-up notifications (FR71), support photo attachments, and bridge Front Door 1 → Front Door 2 upsell pipeline. First-class entity.
- Affects: provider portal, notification system, diagnostic upsell flow

**Inspection Reports (Decision 1.4)**
- Choice: Structured data storage + on-demand PDF generation
- Schema: `inspection_reports` table with `id`, `bookingId` (FK), `providerId`, `findings` (JSONB — structured inspection data), `reportUrl` (text, nullable — cached PDF path), `emailedAt` (timestamp, nullable), `createdAt`
- PDF: Generated via `@react-pdf/renderer` in server API route on demand. HTML preview served instantly.
- Rationale: No file storage infrastructure at Phase 1. Structured data enables HTML preview (fast, mobile-friendly) + PDF download (branded, professional).
- Affects: provider inspection submission, customer report access, email delivery

**Referral Tracking (Decision 1.5)**
- Choice: Hybrid — column on users + separate referrals table
- Users: Add `referralCode` (text, unique, auto-generated via short UUID)
- New table `referrals`: `id`, `referrerId` (FK users), `refereeId` (FK users, nullable), `bookingId` (FK bookings, nullable), `creditAmount` (int, cents), `status` (pending/credited/expired), `createdAt`
- Rationale: Referral code is a user property (persistent, shareable). Redemption history needs its own entity for tracking and credit lifecycle.
- Affects: post-service SMS, signup flow, booking discount application

**Booking Mode (Decision 1.6)**
- Choice: No schema change — existing `scheduledAt` column handles mode (null = immediate, timestamp = scheduled)
- UI: Mode toggle component in booking flow
- Rationale: Schema already supports this. Feature is purely a UI enhancement.

### Authentication & Security

**Trust Tier Zero-Bypass Enforcement (Decision 2.1)**
- Choice: Defense in depth — Hono middleware + Zod validator
- Layer 1: `validatePaymentMethod` middleware on all payment creation endpoints checks `user.trustTier` against requested payment method
- Layer 2: Zod payment creation schema validates payment method eligibility with Trust Tier context
- Layer 3: Automated test on every deploy verifies Tier 1 users cannot reach card payment endpoints
- Rationale: NFR12 requires zero bypass paths. Single-layer enforcement can be circumvented by new routes forgetting middleware. Triple enforcement ensures defense in depth.
- Affects: all payment endpoints, booking creation, admin override flow

### API & Communication Patterns

**Financial Reporting (Decision 3.1)**
- Choice: Real-time aggregation queries at Phase 1
- Approach: PostgreSQL aggregation queries with indexes on `payments.method`, `bookings.createdAt`, `bookings.serviceId`
- Rationale: 5-10 bookings/week is trivial for PostgreSQL. No premature optimization. Revisit with materialized views at Phase 3 (40-75/week).
- Affects: admin financial dashboard, revenue analytics endpoints

**New API Route Modules (Decision 3.2)**

| Module | Path | Middleware | Purpose |
|---|---|---|---|
| `trust-tier.ts` | `/api/admin/trust-tier` | requireAdmin | Tier config, manual overrides |
| `pricing-config.ts` | `/api/admin/pricing` | requireAdmin | Time-block and Storm Mode pricing |
| `observations.ts` | `/api/provider/observations` | requireProvider | Observation submission |
| `inspection-reports.ts` | `/api/inspections` | requireAuth | Report generation, HTML/PDF |
| `referrals.ts` | `/api/referrals` | requireAuth | Referral tracking, credit redemption |
| `financial-reports.ts` | `/api/admin/reports` | requireAdmin | Revenue analytics, payout summaries |

### Frontend Architecture

**Financial Dashboard:** New admin pages using Recharts 3.7.0 (already installed). Server Component pages with client-side chart components. `useEffect` + `fetch` data pattern.

**Booking Mode Toggle:** Single booking component with immediate/scheduled mode selector. Client component with conditional date/time fields. Extends existing booking flow.

**Trust Tier Admin:** Admin page for configuring tier thresholds and viewing customer tier distribution. Table with inline promotion/demotion actions.

### Infrastructure & Deployment

**PDF Generation:** `@react-pdf/renderer` added to dependencies. Added to `serverExternalPackages` in next.config.ts. Runs in Hono API route handler only (Node-only, never client-side).

**New Dependencies:** Only `@react-pdf/renderer`. All other features use existing stack (Stripe, Twilio, Resend, ws, Recharts).

**No infrastructure changes:** Same Docker multi-stage build, same Coolify deployment, same PostgreSQL instance. 6-8 new tables added via Drizzle migrations.

### Decision Impact Analysis

**Implementation Sequence (dependency-ordered):**
1. Trust Tier (schema + middleware + admin UI) — blocks payment hardening
2. Time-Block Pricing (schema + pricing engine + admin config) — blocks booking flow
3. Payment Flow Hardening (confirmation workflow + batch payouts + receipts) — depends on Trust Tier
4. Booking Flow: Now + Scheduled (UI toggle + scheduling logic) — uses time-block pricing
5. Financial Reporting (aggregation queries + admin dashboard) — depends on payment flow
6. Vehicle Observation Checklist (schema + provider UI + follow-ups) — independent
7. Post-Service Referral Text (schema + SMS trigger + credits) — independent
8. Tiered Commission (config update + payout calculator) — independent
9. Branded Inspection Report (schema + PDF generator + email) — independent

**Cross-Component Dependencies:**
- Trust Tier → Payment validation → Booking creation (chain)
- Time-Block Pricing → Booking price calculation → Financial reporting (chain)
- Observations → Follow-up notifications → Diagnostic upsell (chain)
- Referral code → SMS trigger → Credit redemption → Booking discount (chain)

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

**12 conflict areas** where AI agents implementing the 9 new features could make inconsistent choices. The existing project-context.md covers general conventions (127 rules). These patterns address the **gaps** specific to new feature development.

### Naming Patterns

**New Database Tables & Columns:**

All new tables follow the established schema — but the 9 features introduce naming decisions not yet established:

| Pattern | Convention | Example |
|---|---|---|
| Config tables | `{concept}_configs` (plural noun + configs) | `time_block_configs`, NOT `timeBlockConfig` or `pricing_config` |
| Status enums | `{entity}StatusEnum` suffix, lowercase values with underscores | `referralStatusEnum("referral_status", ["pending", "credited", "expired"])` |
| JSONB columns | camelCase column name, `.$type<T>()` for typing | `items: jsonb("items").$type<ObservationItem[]>()` |
| Boolean columns | `is*` or `has*` prefix, camelCase | `isActive`, `followUpSent` (exception: past-tense boolean is `*Sent`/`*At` pattern) |
| Nullable timestamps for "did this happen" | `*At` suffix | `emailedAt`, `issuedAt`, `paidAt` — use timestamp, NOT boolean |
| Basis-point integers | column name describes the concept, NOT the unit | `multiplier` (int, 10000 = 1.0x), `commissionRate` (int, basis points) |

**New API Route Paths:**

| Pattern | Convention | Example |
|---|---|---|
| Admin endpoints | `/api/admin/{resource}` | `/api/admin/trust-tier`, `/api/admin/pricing` |
| Provider endpoints | `/api/provider/{resource}` | `/api/provider/observations` |
| Shared endpoints | `/api/{resource}` | `/api/referrals`, `/api/inspections` |
| Status updates | `PATCH /:id/status` | NOT `PATCH /:id` with status in body, NOT `POST /:id/update-status` |
| Config endpoints | `GET /` (list), `PUT /:id` (update config) | Admin pricing: `GET /api/admin/pricing`, `PUT /api/admin/pricing/:id` |

**New Audit Actions:**

Follow existing `entity.verb_noun` pattern (dot-separated resource, snake_case action):

```
trust_tier.promote | trust_tier.demote | trust_tier.admin_override
pricing.update_block | pricing.toggle_storm_mode
observation.submit | observation.follow_up_sent
referral.create | referral.credit | referral.expire
inspection.generate | inspection.email_sent
```

### Structure Patterns

**New Feature File Organization:**

Every new feature follows the same 6-file pattern from the existing checklist:

```
db/schema/{entity}.ts              → Schema definition
server/api/routes/{feature}.ts     → Hono route module
server/api/index.ts                → Route registration (add one line)
lib/validators.ts                  → Zod schemas (append to existing file)
lib/constants.ts                   → Enums/constants (append to existing file)
app/(route-group)/path/page.tsx    → Page component
components/{domain}/component.tsx  → Domain component
```

**What NOT to create:**
- No `lib/trust-tier/` directories — domain logic lives in route handlers or `server/api/lib/`
- No `types/trust-tier.d.ts` — types co-located or inferred from Zod
- No `lib/hooks/use-trust-tier.ts` unless there's reusable client-side logic
- No `components/trust-tier/` — use `components/admin/` (matches route group)

**Server-side utility placement:**

| Type | Location | Example |
|---|---|---|
| Pricing calculation engine | `server/api/lib/pricing-engine.ts` | Centralized price resolver with time-block + storm mode |
| PDF generation | `server/api/lib/pdf-generator.ts` | `@react-pdf/renderer` templates |
| Referral credit logic | `server/api/lib/referral-credits.ts` | Credit calculation and application |
| Trust Tier promotion logic | `server/api/lib/trust-tier.ts` | Tier thresholds, auto-promotion checks |

### Format Patterns

**API Response Formats:**

All new endpoints follow the existing response patterns:

| Scenario | Format | Example |
|---|---|---|
| Single resource | `c.json(data, 200)` — direct object, no wrapper | `c.json({ id, trustTier, ... }, 200)` |
| List with pagination | `c.json({ data: [], total, page, totalPages }, 200)` | Consistent with existing admin/bookings |
| Success mutation | `c.json(updatedResource, 200)` — return the updated entity | `c.json(updatedUser, 200)` |
| Validation error | `c.json({ error: "Invalid input", details: parsed.error.issues }, 400)` | Zod safeParse failure |
| Not found | `c.json({ error: "X not found" }, 404)` | Singular entity name |
| Business rule violation | `c.json({ error: "Descriptive message" }, 400)` | `"Trust Tier 1 users cannot use card payments"` |
| Unauthorized | Handled by middleware — never in route handler | `requireAdmin` returns 403 |

**Financial Data Formats:**

| Data | Format | Example |
|---|---|---|
| Money amounts | Integer cents, always | `{ amount: 5000 }` = $50.00 |
| Percentages | Basis points (integer), always | `{ multiplier: 12500 }` = 1.25x = 125% |
| Date ranges in queries | ISO string query params | `?startDate=2026-01-01&endDate=2026-01-31` |
| Time-of-day | 24-hour integer (0-23) | `{ startHour: 18, endHour: 6 }` for 6 PM → 6 AM |
| Report aggregations | Return raw values, format on client | API returns cents, client calls `formatPrice()` |

### Communication Patterns

**WebSocket Events for New Features:**

Follow existing `entity:action` pattern (colon-separated, snake_case action):

| Event | Direction | Payload |
|---|---|---|
| `trust_tier:changed` | Server → Admins | `{ userId, previousTier, newTier, reason }` |
| `storm_mode:activated` | Server → All connected | `{ activatedBy, multiplier }` |
| `storm_mode:deactivated` | Server → All connected | `{ deactivatedBy }` |
| `observation:submitted` | Server → Admins | `{ bookingId, providerId, itemCount }` |

**Notification Triggers (Fire-and-Forget):**

| Trigger | Channels | Pattern |
|---|---|---|
| Trust Tier promotion | SMS + email | `notifyTierPromotion(userId, newTier).catch(() => {})` |
| Observation follow-up | SMS + email | `notifyObservationFollowUp(customerId, findings).catch(() => {})` |
| Referral credit applied | SMS | `notifyReferralCredit(userId, amount).catch(() => {})` |
| Inspection report ready | Email (with PDF) | `emailInspectionReport(email, reportId).catch(() => {})` |
| Storm Mode activated | Push to all providers | `notifyStormMode(multiplier).catch(() => {})` |

### Process Patterns

**Trust Tier State Machine:**

```
Tier 1 (New Customer)
  → N clean transactions → Tier 2 (Trusted)
  → Chargeback/dispute → Reset to Tier 1
  → Admin override → Any tier (audited)

Tier 1: cash, cashapp, zelle only
Tier 2: all methods including stripe/card
```

**Enforcement must occur at:**
1. `validatePaymentMethod` Hono middleware — checks `user.trustTier` before payment endpoints
2. Booking creation Zod schema — validates payment method against tier
3. Client-side UI — disable card option for Tier 1 (UX only, not security)

**Pricing Calculation Pipeline:**

All price calculations flow through a single function:

```
calculateBookingPrice(serviceId, scheduledAt?) → {
  basePrice: number (cents),
  multiplier: number (basis points),
  blockName: string,
  finalPrice: number (cents)
}
```

Rules:
- Always return all intermediate values (auditable)
- `finalPrice = Math.round(basePrice * multiplier / 10000)`
- Storm Mode overrides time-block if active (highest priority)
- Never calculate price in a component — always server-side

**Error Handling for New Features:**

| Scenario | Pattern |
|---|---|
| Trust Tier bypass attempt | Return `400` with clear message, log audit with `trust_tier.bypass_attempt` |
| Storm Mode pricing conflict | Highest-priority config wins, log which config applied |
| PDF generation failure | Return `500`, store structured data (always available as HTML fallback) |
| Referral code not found | Return `404`, do NOT reveal whether code exists |
| Duplicate observation submission | Return `409` with `{ error: "Observation already submitted for this booking" }` |

**Loading & Data Fetching for New Pages:**

All new admin/provider pages follow the existing pattern:

```tsx
// Server Component page.tsx — minimal, delegates to client component
export default function FeaturePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Page Title</h1>
      <FeatureComponent />
    </div>
  );
}

// Client component — useEffect + fetch + loading/error states
"use client";
export function FeatureComponent() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  // ... fetch from /api/... in useEffect
}
```

### Enforcement Guidelines

**All AI Agents MUST:**

1. Read `_bmad-output/project-context.md` before writing any code — the 127 rules are non-negotiable
2. Run through the "Adding New Features Checklist" for every new feature — no shortcuts
3. Add new audit actions to the `AuditAction` type union in `audit-logger.ts` before using them
4. Add new constants/enums to `lib/constants.ts` — never create per-feature constant files
5. Add new validators to `lib/validators.ts` — never create per-feature validator files
6. Register new routes in `server/api/index.ts` — forgetting this silently breaks the endpoint
7. Export new schemas from `db/schema/index.ts` — forgetting this breaks all imports
8. Use `formatPrice()` for all money display — never `(amount / 100).toFixed(2)`
9. Include `updatedAt: new Date()` in every Drizzle `.update().set()` call — no exceptions
10. Use `logAudit()` for every state-changing operation on new features

**Pattern Verification:**

- Every new Hono route module must have auth middleware applied (`requireAuth`, `requireAdmin`, or `requireProvider`)
- Every new schema file must have `id: text("id").primaryKey().$defaultFn(() => createId())`
- Every new table must have `createdAt` and `updatedAt` timestamps
- Every new endpoint that modifies state must call `logAudit()`
- Trust Tier enforcement must exist at BOTH middleware AND validator layers

### Anti-Patterns for New Features

| DO NOT | INSTEAD |
|---|---|
| Create `lib/pricing-utils.ts` for price formatting | Use existing `formatPrice()` from `lib/utils.ts` |
| Add Trust Tier check only in UI | Enforce at middleware + validator + UI (defense in depth) |
| Store multipliers as decimals (1.25) | Use basis points (12500) — integer math, no floating point |
| Create `POST /api/admin/trust-tier/promote/:id` | Use `PATCH /api/admin/trust-tier/:id` with `{ trustTier: 2 }` |
| Import `@react-pdf/renderer` in any client component | Isolate in `server/api/lib/pdf-generator.ts`, call via API route |
| Create separate `types/observations.ts` | Co-locate types in schema file or infer from Zod |
| Calculate price in `components/booking/` | Call pricing API endpoint, display result |
| Skip audit log for "minor" operations | Log everything — trust tier changes, pricing updates, storm mode toggles |

## Project Structure & Boundaries

### Requirements to Structure Mapping

**9 MVP Features → File Locations:**

| Feature | Schema | Route Module | Server Lib | Page(s) | Component(s) |
|---|---|---|---|---|---|
| 1. Trust Tier | `db/schema/users.ts` (add columns) | `server/api/routes/trust-tier.ts` | `server/api/lib/trust-tier.ts` | `app/(admin)/admin/trust-tier/page.tsx` | `components/admin/trust-tier-table.tsx` |
| 2. Time-Block Pricing | `db/schema/time-block-configs.ts` | `server/api/routes/pricing-config.ts` | `server/api/lib/pricing-engine.ts` | `app/(admin)/admin/pricing/page.tsx` | `components/admin/pricing-config-table.tsx` |
| 3. Payment Flow Hardening | (uses existing payments) | (extends `server/api/routes/payments.ts`) | `server/api/middleware/trust-tier.ts` | — | `components/booking/payment-method-selector.tsx` |
| 4. Booking Flow: Now + Scheduled | (uses existing scheduledAt) | (extends `server/api/routes/bookings.ts`) | (uses pricing-engine) | — | `components/booking/booking-mode-toggle.tsx` |
| 5. Financial Reporting | — | `server/api/routes/financial-reports.ts` | — | `app/(admin)/admin/reports/page.tsx` | `components/admin/financial-dashboard.tsx`, `components/admin/report-charts.tsx` |
| 6. Vehicle Observations | `db/schema/observations.ts` | `server/api/routes/observations.ts` | — | `app/(provider)/provider/observations/page.tsx` | `components/provider/observation-form.tsx`, `components/provider/observation-checklist.tsx` |
| 7. Referral Text | `db/schema/referrals.ts` | `server/api/routes/referrals.ts` | `server/api/lib/referral-credits.ts` | `app/(admin)/admin/referrals/page.tsx` | `components/admin/referrals-table.tsx` |
| 8. Tiered Commission | (extends existing providers) | (extends existing admin-providers) | (extends `payout-calculator.ts`) | — | — |
| 9. Branded Inspection Report | `db/schema/inspection-reports.ts` | `server/api/routes/inspection-reports.ts` | `server/api/lib/pdf-generator.ts` | `app/(provider)/provider/inspections/page.tsx` | `components/provider/inspection-form.tsx`, `components/provider/inspection-preview.tsx` |

### Complete Project Directory Structure

New files marked with `← NEW`. Modified files marked with `← MODIFY`.

```
road-side-atl/
├── app/
│   ├── (admin)/
│   │   └── admin/
│   │       ├── page.tsx                          # Existing dashboard
│   │       ├── pricing/
│   │       │   └── page.tsx                      ← NEW (time-block pricing config)
│   │       ├── reports/
│   │       │   └── page.tsx                      ← NEW (financial reporting dashboard)
│   │       ├── trust-tier/
│   │       │   └── page.tsx                      ← NEW (trust tier management)
│   │       ├── referrals/
│   │       │   └── page.tsx                      ← NEW (referral tracking)
│   │       ├── ... (existing: bookings, customers, payouts, providers, revenue, etc.)
│   │
│   ├── (provider)/
│   │   └── provider/
│   │       ├── observations/
│   │       │   └── page.tsx                      ← NEW (observation submission history)
│   │       ├── inspections/
│   │       │   └── page.tsx                      ← NEW (inspection report management)
│   │       ├── ... (existing: jobs, settings, invoices, earnings)
│   │
│   ├── (marketing)/
│   │   ├── book/
│   │   │   └── page.tsx                          ← MODIFY (add mode toggle)
│   │   ├── ... (existing pages)
│   │
│   ├── ... (existing: (auth), (dashboard), api/, layout.tsx, globals.css)
│
├── components/
│   ├── admin/
│   │   ├── trust-tier-table.tsx                  ← NEW (tier management + override actions)
│   │   ├── pricing-config-table.tsx              ← NEW (time-block config editor)
│   │   ├── storm-mode-toggle.tsx                 ← NEW (storm mode activation switch)
│   │   ├── financial-dashboard.tsx               ← NEW (revenue + payout summary)
│   │   ├── report-charts.tsx                     ← NEW (Recharts financial charts)
│   │   ├── referrals-table.tsx                   ← NEW (referral tracking table)
│   │   ├── sidebar.tsx                           ← MODIFY (add nav items)
│   │   ├── admin-mobile-nav.tsx                  ← MODIFY (add nav items)
│   │   ├── ... (existing: bookings-table, customers-table, etc.)
│   │
│   ├── booking/
│   │   ├── booking-mode-toggle.tsx               ← NEW (now/scheduled switcher)
│   │   ├── payment-method-selector.tsx           ← NEW (tier-aware payment options)
│   │   ├── booking-form.tsx                      ← MODIFY (integrate mode toggle + pricing display)
│   │   ├── payment-instructions.tsx              # Existing
│   │
│   ├── provider/
│   │   ├── observation-form.tsx                  ← NEW (checklist submission form)
│   │   ├── observation-checklist.tsx             ← NEW (category-based checklist UI)
│   │   ├── inspection-form.tsx                   ← NEW (inspection data entry)
│   │   ├── inspection-preview.tsx                ← NEW (HTML preview of report)
│   │   ├── provider-sidebar.tsx                  ← MODIFY (add nav items)
│   │   ├── provider-mobile-nav.tsx               ← MODIFY (add nav items)
│   │   ├── ... (existing: job-card, location-tracker, status-updater)
│   │
│   ├── ... (existing: dashboard, maps, marketing, notifications, providers, reviews, seo, ui)
│
├── server/
│   ├── api/
│   │   ├── index.ts                              ← MODIFY (register 6 new route modules)
│   │   ├── routes/
│   │   │   ├── trust-tier.ts                     ← NEW (admin trust tier management)
│   │   │   ├── pricing-config.ts                 ← NEW (time-block pricing CRUD)
│   │   │   ├── observations.ts                   ← NEW (provider observation submission)
│   │   │   ├── inspection-reports.ts             ← NEW (report generation + PDF)
│   │   │   ├── referrals.ts                      ← NEW (referral tracking + credits)
│   │   │   ├── financial-reports.ts              ← NEW (revenue analytics)
│   │   │   ├── bookings.ts                       ← MODIFY (pricing engine integration)
│   │   │   ├── payments.ts                       ← MODIFY (trust tier enforcement)
│   │   │   ├── ... (existing: 15 route modules)
│   │   │
│   │   ├── middleware/
│   │   │   ├── trust-tier.ts                     ← NEW (validatePaymentMethod middleware)
│   │   │   ├── auth.ts                           # Existing
│   │   │   └── rate-limit.ts                     # Existing
│   │   │
│   │   └── lib/
│   │       ├── trust-tier.ts                     ← NEW (tier promotion logic)
│   │       ├── pricing-engine.ts                 ← NEW (centralized price calculation)
│   │       ├── pdf-generator.ts                  ← NEW (@react-pdf/renderer templates)
│   │       ├── referral-credits.ts               ← NEW (credit calculation + application)
│   │       ├── audit-logger.ts                   ← MODIFY (add new audit action types)
│   │       ├── payout-calculator.ts              ← MODIFY (tiered commission support)
│   │       ├── ... (existing: auto-dispatch, rate-limiter)
│   │
│   └── websocket/                                # No changes needed
│
├── db/
│   ├── schema/
│   │   ├── users.ts                              ← MODIFY (add trustTier + cleanTransactionCount + referralCode)
│   │   ├── time-block-configs.ts                 ← NEW
│   │   ├── observations.ts                       ← NEW
│   │   ├── inspection-reports.ts                 ← NEW
│   │   ├── referrals.ts                          ← NEW
│   │   ├── index.ts                              ← MODIFY (export new schemas)
│   │   ├── ... (existing: services, providers, bookings, payments, etc.)
│   │
│   ├── migrations/                               # Generated by drizzle-kit
│   ├── seed.ts                                   ← MODIFY (seed time-block defaults)
│   └── index.ts                                  # Existing DB connection
│
├── lib/
│   ├── constants.ts                              ← MODIFY (add TRUST_TIERS, OBSERVATION_CATEGORIES, REFERRAL_STATUSES)
│   ├── validators.ts                             ← MODIFY (add new Zod schemas)
│   ├── notifications/
│   │   ├── index.ts                              ← MODIFY (add new notification dispatchers)
│   │   ├── sms.ts                                ← MODIFY (add referral + observation templates)
│   │   ├── email.ts                              ← MODIFY (add inspection report email)
│   │   └── push.ts                               ← MODIFY (add storm mode push)
│   ├── ... (existing: auth, hooks, utils, stripe, etc.)
│
├── ... (existing root config files unchanged)
```

### Architectural Boundaries

**API Boundaries:**

| Boundary | Enforced By | Description |
|---|---|---|
| Admin-only endpoints | `requireAdmin` middleware | `/api/admin/*` — trust tier, pricing, reports, referrals |
| Provider-only endpoints | `requireProvider` middleware | `/api/provider/*` — observations |
| Auth-required endpoints | `requireAuth` middleware | `/api/inspections/*`, `/api/referrals/*` |
| Trust Tier payment gate | `validatePaymentMethod` middleware | Applied to all payment creation paths |
| Rate limiting | `rateLimitStrict` middleware | Applied to all state-changing new endpoints |

**Component Boundaries:**

| Boundary | Rule |
|---|---|
| Admin components | `components/admin/` — only imported by `app/(admin)/` pages |
| Provider components | `components/provider/` — only imported by `app/(provider)/` pages |
| Booking components | `components/booking/` — imported by `app/(marketing)/book/` |
| PDF generation | `server/api/lib/pdf-generator.ts` — NEVER imported by any file outside `server/` |
| Pricing engine | `server/api/lib/pricing-engine.ts` — called by route handlers only, never from components |

**Data Boundaries:**

| Boundary | Rule |
|---|---|
| Price calculation | Always server-side via pricing engine — client receives final price |
| Trust Tier reads | Route handlers query `users.trustTier` directly — no separate trust tier table |
| Observation JSONB | Schema typed via `.$type<T>()` — runtime validated via Zod |
| Financial aggregations | Raw SQL aggregations in route handlers — no ORM aggregation helpers |
| Audit log writes | Always via `logAudit()` — never direct table insert from route handlers |

### Integration Points

**Internal Communication:**

```
Booking Flow:
  booking-form.tsx → POST /api/bookings → pricing-engine.ts → time_block_configs table
                                        → trust-tier middleware → users.trustTier check
                                        → logAudit("booking.create")

Payment Flow:
  payment-method-selector.tsx → POST /api/payments/... → validatePaymentMethod middleware
                                                       → trust-tier.ts (tier check)
                                                       → payout-calculator.ts (commission)
                                                       → logAudit("payment.confirm")

Observation Flow:
  observation-form.tsx → POST /api/provider/observations → observations table
                                                         → notifyObservationFollowUp()
                                                         → logAudit("observation.submit")

Referral Flow:
  (post-service SMS) → /api/referrals/validate → referrals table
                     → booking discount         → referral-credits.ts
                                                → logAudit("referral.credit")

Inspection Flow:
  inspection-form.tsx → POST /api/inspections → inspection_reports table
                      → GET /api/inspections/:id/pdf → pdf-generator.ts
                      → POST /api/inspections/:id/email → email notification
```

**External Integrations (unchanged):**

| Service | Touch Points | New Feature Impact |
|---|---|---|
| Stripe | `payments.ts`, `webhooks.ts` | Trust Tier gates Stripe access |
| Twilio | `lib/notifications/sms.ts` | Referral SMS, observation follow-up |
| Resend | `lib/notifications/email.ts` | Inspection report email with PDF |
| Google Maps | `geocoding.ts`, maps components | No changes |

### New Files Summary

| Category | New Files | Modified Files |
|---|---|---|
| Schema | 4 | 2 |
| Route modules | 6 | 2 |
| Server libs | 4 | 2 |
| Middleware | 1 | 0 |
| Pages | 6 | 1 |
| Components | 10 | 5 |
| Shared libs | 0 | 5 |
| **Total** | **31 new files** | **17 modified files** |

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** All 11 architectural decisions are compatible. Technology stack is locked brownfield — no version conflicts. `@react-pdf/renderer` is the only new dependency (Node.js 20 + Next.js standalone compatible). Basis-point integer math used consistently across pricing, commission, and multiplier calculations — no mixed decimal/integer risk.

**Pattern Consistency:** All 12 naming conflict areas resolved with conventions extracted from existing codebase. New API routes follow identical Hono pattern. New schema files follow identical Drizzle pattern. Audit action naming (`entity.verb_noun`) consistent with existing 24 action types.

**Structure Alignment:** 31 new files placed in existing directory hierarchy — no new top-level folders. All boundaries respect existing route group → component domain mapping. Server-side utilities in `server/api/lib/` consistent with existing patterns.

### Requirements Coverage

**FR Coverage: 83/83 (100%)**

| Category | FR Count | Covered | Architecture Decisions |
|---|---|---|---|
| Service Booking & Dispatch | 12 | 12/12 | Time-Block Pricing, Booking Mode, Pricing Engine |
| Payment & Financial Operations | 13 | 13/13 | Trust Tier (3-layer), Financial Reporting |
| Real-Time Tracking & Communication | 9 | 9/9 | Existing WebSocket + new event types |
| Provider Management | 13 | 13/13 | Observations, Tiered Commission, Inspections |
| Customer Account & Trust | 8 | 8/8 | Trust Tier schema, Referrals, Dual-role |
| B2B Account Management | 8 | 8/8 | tenantId pattern (Phase 2, architecture defined) |
| Diagnostics & Inspection | 8 | 8/8 | Inspection Reports, PDF generation |
| Platform Administration | 12 | 12/12 | Admin route modules, pricing config |

**NFR Coverage: 50/50 (100%)**

| Category | NFR Count | Covered | Key Pattern |
|---|---|---|---|
| Performance (NFR1-10) | 10 | 10/10 | Async PDF, real-time aggregation, Next.js optimization |
| Security (NFR11-20) | 10 | 10/10 | Defense-in-depth Trust Tier, immutable audit, Stripe tokenization |
| Scalability (NFR21-28) | 8 | 8/8 | Upgrade paths documented (materialized views Phase 3+) |
| Reliability (NFR29-38) | 10 | 10/10 | DB persistence, fire-and-forget degradation |
| Accessibility (NFR39-45) | 7 | 7/7 | shadcn/ui WCAG 2.1 AA, responsive patterns |
| Integration (NFR46-50) | 5 | 5/5 | Zod validation, ORM layer, webhook verification |

**Orphaned Requirements:** 0 | **Over-engineered Decisions:** 0

### Gap Analysis

**Critical Gaps:** None.

**Minor Enhancement Suggestions (non-blocking):**
1. **Observability** — No monitoring dashboards defined for Trust Tier bypass attempts, Storm Mode frequency, or PDF generation failures. `logAudit()` captures the data; dashboards are post-MVP.
2. **Rollback Procedures** — No explicit bulk rollback for Storm Mode deactivation or Trust Tier reversion. Admin PATCH endpoints handle individual cases.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed (127 rules, 14 tables, 70+ endpoints)
- [x] Scale and complexity assessed (High complexity, brownfield)
- [x] Technical constraints identified (locked stack, anti-patterns preserved)
- [x] Cross-cutting concerns mapped (6 concerns)

**Architectural Decisions**
- [x] Critical decisions documented with rationale (11 decisions)
- [x] Technology stack fully specified (all versions locked)
- [x] Integration patterns defined (internal flows + external services)
- [x] Performance considerations addressed (real-time aggregation at Phase 1)

**Implementation Patterns**
- [x] Naming conventions established (database, API, code, audit actions)
- [x] Structure patterns defined (6-file feature pattern)
- [x] Communication patterns specified (WebSocket events, notifications)
- [x] Process patterns documented (Trust Tier state machine, pricing pipeline, error handling)

**Project Structure**
- [x] Complete directory structure defined (31 new, 17 modified)
- [x] Component boundaries established (API, component, data)
- [x] Integration points mapped (5 internal flows)
- [x] Requirements to structure mapping complete (9 features → file locations)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Zero-bypass Trust Tier enforcement via defense in depth (middleware + validator + automated test)
- Brownfield consistency — all new code follows identical patterns to existing 70+ endpoints
- 127 documented agent rules eliminate implementation ambiguity
- Integer math throughout (cents + basis points) — no floating-point financial bugs
- Clear dependency-ordered implementation sequence

**Areas for Future Enhancement:**
- Observability dashboards for new features (post-MVP)
- Materialized views for financial aggregation (Phase 3+, >40 bookings/week)
- B2B schema implementation (Phase 2, architecture defined now)

### Implementation Handoff

**AI Agent Guidelines:**
1. Read `_bmad-output/project-context.md` first — 127 rules are mandatory
2. Follow implementation sequence: Trust Tier → Time-Block Pricing → Payment Hardening → Booking Flow → Financial Reporting → (independent features)
3. Use the 6-file feature pattern for every new feature
4. Every state change gets `logAudit()` — no exceptions
5. Every new endpoint gets auth middleware — no exceptions

**First Implementation Step:**
1. `npm install @react-pdf/renderer`
2. Add `trustTier`, `cleanTransactionCount`, `referralCode` columns to `db/schema/users.ts`
3. Create `db/schema/time-block-configs.ts`
4. Run `npm run db:generate` + `npm run db:migrate`
5. Implement `server/api/middleware/trust-tier.ts`

---

## Provider Onboarding — Extension

_This section extends the architecture document with decisions specific to the Provider Onboarding feature (PRD: `prd-provider-onboarding.md`, 59 FRs, 29 NFRs). All existing architectural decisions above remain in effect. Provider Onboarding builds on the established patterns and adds new concerns._

## Provider Onboarding — Project Context Analysis

### Requirements Overview

**Functional Requirements:**
59 FRs across 7 capability areas. Highest-density areas are Onboarding Pipeline (FR1–FR16, 16 FRs) and Document Management (FR17–FR25, 9 FRs). The onboarding state machine (`applied → onboarding → pending_review → active / rejected / suspended`) is the most architecturally significant feature — it introduces a new provider lifecycle that gates dispatch eligibility and must integrate with the existing `requireProvider` middleware.

**Non-Functional Requirements:**
29 NFRs across Performance (6), Security (8), Integration (4), Reliability (6), Scalability (5). Security NFRs are the most constraining — webhook signature validation, document encryption at rest, PII handling for background check data, and Stripe Connect account isolation all require patterns baked into the data layer.

**Scale & Complexity:**

- Primary domain: Full-stack web (brownfield feature expansion)
- Complexity level: Medium-High
- New external services: 2 (Checkr, Stripe Connect Express)
- New schema entities: ~6-8 new tables
- New route modules: ~5-6
- New middleware: `requireOnboardingComplete` (conditional dispatch gate)

### Technical Constraints & Dependencies

**New external service dependencies:**
- **Checkr API** — Background check initiation, webhook status updates, candidate management. Hard gate: no provider activation without clear background check.
- **Stripe Connect Express** — Embedded onboarding for provider identity verification, bank account, and tax info. Payout routing from platform Stripe account to connected accounts.
- **S3 document uploads** — Already integrated for other features. Extends to insurance certificates, certifications, vehicle documentation.

**Critical schema decision flagged:** The onboarding data model presents a fork — **JSONB columns vs. normalized tables** for storing per-step completion data, document metadata, and background check results. This decision has cascading effects on query patterns, admin review UX, and migration complexity. Must be resolved in Decisions section.

**Existing architecture integration points:**
- `users` table needs new provider status columns and onboarding state
- `requireProvider` middleware must be complemented with `requireOnboardingComplete` — **chained sequentially**: `requireProvider` first (establishes user context), then `requireOnboardingComplete` (checks onboarding status). Architecture must specify which provider routes get both vs. auth-only.
- Notification system (Resend + Twilio) already exists — new templates for onboarding events
- WebSocket server already running — new events for real-time onboarding progress
- Audit logger (`logAudit()`) already exists — new action types for onboarding operations

### State Transition Authority Matrix

The onboarding state machine has transitions triggered by three distinct actors. Each transition requires different validation and lives in different architectural layers:

| Transition | Triggered By | Validation | Where Enforced |
|---|---|---|---|
| `applied → onboarding` | System (on first step action) | Automatic | Route handler |
| `onboarding → pending_review` | System (all steps complete) | All steps marked complete | Route handler + step completion check |
| `pending_review → active` | Admin | Admin review approval | Admin route + `requireAdmin` |
| `pending_review → rejected` | Admin | Admin review with reason (required) | Admin route + `requireAdmin` |
| `rejected → applied` | Provider (reapply) | Cool-down period enforced; old data retained, new onboarding record linked to previous | Route handler + cool-down validation |
| `active → suspended` | Admin or System | Policy violation or expired documents | Admin route or background job |
| `suspended → onboarding` | Admin (reinstatement) | Admin initiates, provider must re-complete failed steps | Admin route |

**Rejected → Reapply data retention:** Previous application data (background check results, document submissions, rejection reasons) is retained in the original record for audit and compliance. A reapply creates a new onboarding workflow instance linked to the same provider record via a `previousApplicationId` reference. This preserves history without polluting active onboarding state.

### Cross-Cutting Concerns Identified

1. **Provider lifecycle enforcement** — Onboarding status must gate dispatch, job acceptance, and payout eligibility. The `requireOnboardingComplete` middleware applies defense-in-depth (same philosophy as Trust Tier enforcement). Middleware chain ordering: `requireProvider` → `requireOnboardingComplete` as sequential `.use()` calls on dispatch-gated routes. Conditional bypass for migrating existing providers must be auditable — every bypass logged with reason, admin who approved, and expiration. Bypass enforced via `migrationBypassExpiresAt` timestamp column on the provider record — checked at middleware execution time against `NOW()`, not via cron. When the timestamp passes, the bypass is dead. Deterministically testable.

2. **External service resilience (split pattern)** — Checkr and Stripe Connect have fundamentally different failure profiles requiring distinct resilience strategies:

   **2a. Async-webhook services (Checkr):**
   - **Primary:** Webhook handler receives background check status updates
   - **Fallback:** Polling reconciliation — `GET /v1/reports/{id}` every 6 hours for candidates without webhook response within 24h
   - **Recovery:** Manual admin status override (last resort, fully audited)

   **2b. Redirect-flow services (Stripe Connect Express):**
   - **Primary:** Return URL detection — provider completes Stripe's hosted flow and redirects back
   - **Fallback:** Return detection + abandonment reminder — if provider generated an onboarding link but no return detected within 24h, send SMS/email reminder
   - **Recovery:** Admin can re-generate onboarding link or manually mark Stripe step as complete (audited)

3. **Document management pipeline** — S3 uploads for insurance, certifications, vehicle docs. Server-side file validation (file content inspection per existing pattern). Document expiration tracking (insurance renewals). Admin review workflow with approve/reject/request-resubmission states.

4. **Notification orchestration** — Onboarding triggers notifications at every state transition: application received, background check initiated/completed, document review results, Stripe setup reminders, activation confirmation. Must use existing fire-and-forget pattern with proper error logging.

5. **Payout routing via Connect account existence** — No `payoutMode` column. Routing logic is implicit: if a provider has a `stripeConnectAccountId`, they receive automated payouts via Stripe Connect. If they don't, they receive manual payouts via the existing flow. When migration completes and all providers have Connect accounts, the manual payout code path is dead — delete it. No schema cleanup, no mode migration. The data IS the routing.

6. **Migration temporal state management** — Existing active providers must be migrated into the new onboarding system without disrupting their ability to accept jobs. Dual-state period: providers are simultaneously "active" (can work) and "migrating" (completing onboarding steps retroactively). The `requireOnboardingComplete` middleware supports conditional bypass via a `migrationBypassExpiresAt` timestamp column — a hard database-level expiration, queryable and auditable. Checked at request time against `NOW()`, not via background cron. Deterministically testable in integration tests.

7. **Session resumability** — Providers are mobile-first, frequently interrupted by dispatch calls mid-onboarding. Every onboarding step must persist partial state — not just `pending` / `complete` / `blocked` but also `draft` (in-progress with saved partial data). Schema for each onboarding step entity must support draft data persistence so providers return to exactly where they left off. This is an architectural requirement on the data model, not a UX enhancement.

## Provider Onboarding — Starter Template Evaluation

### Primary Technology Domain

Full-stack web application (SSR + real-time + REST API) — brownfield feature expansion on existing codebase.

### Starter Options Considered

**Not applicable.** This is a brownfield extension to a platform already in production. All technology selections are locked (documented in the original architecture above). Provider Onboarding adds **no new frameworks** — it extends existing patterns with two new external service integrations.

### Selected Starter: Existing Codebase

**Rationale:** No initialization needed. Provider Onboarding extends the existing architecture — it adds tables, routes, middleware, and components following all established patterns.

### New Dependencies Required

| Dependency | Purpose | Status |
|---|---|---|
| `checkr-node` (or direct API) | Background check initiation + candidate management | New — evaluate SDK vs. direct REST |
| Stripe Connect (via existing `stripe` package) | Express account creation, onboarding links, payouts | Already installed — `stripe@20.3.0` supports Connect |
| S3 uploads (via existing AWS integration) | Document uploads (insurance, certs, vehicle docs) | Already integrated — extend existing patterns |

### Architectural Decisions Already Established (Inherited)

All decisions from the original architecture apply unchanged:
- **Language & Runtime:** TypeScript 5 strict mode, Node.js 20 Alpine
- **Styling:** Tailwind CSS v4, shadcn/ui
- **Build:** Next.js standalone Docker output
- **Testing:** Vitest 4.0.18
- **Code Organization:** Route groups, Hono API, Drizzle schema per entity
- **Development Experience:** Next.js dev server, ESLint flat config, Docker Compose

### Checkr Integration Decision: SDK vs. Direct REST

Deferred to Core Architectural Decisions section — this is an architectural decision, not a starter selection.

## Provider Onboarding — Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Onboarding data model — normalized `onboarding_steps` table (hybrid with JSONB draft data)
2. Checkr integration — direct REST via `fetch` with typed wrapper
3. `requireOnboardingComplete` middleware — chained after `requireProvider`, bypass via timestamp
4. Provider table extensions — extend existing `providerStatusEnum`, add Connect + migration columns

**Important Decisions (Shape Architecture):**
5. Document management — separate `provider_documents` table with review workflow
6. Stripe Connect Express — `stripeConnectAccountId` on providers, implicit payout routing
7. Background check data — minimal storage on step metadata JSONB, FCRA consent via audit log
8. New API route modules — 1 new module + 2 extensions
9. New server-side utilities — Checkr wrapper + onboarding middleware

**Deferred Decisions (Post-MVP):**
10. Onboarding analytics dashboard — Phase 2
11. Automated document expiration reminders — Phase 2 (manual admin process initially)
12. Bulk admin review tools — Phase 2 (when concurrent > 20)

### Data Architecture

**Onboarding Step Tracking (Decision 1.1)**
- Choice: Normalized `onboarding_steps` table with `draftData` JSONB column (hybrid)
- Schema: `id` (text PK), `providerId` (text, FK providers), `stepType` (enum), `status` (enum), `draftData` (JSONB, nullable — partial progress), `metadata` (JSONB, nullable — step-specific data like Checkr IDs), `completedAt` (timestamp, nullable), `reviewedBy` (text, nullable), `reviewedAt` (timestamp, nullable), `rejectionReason` (text, nullable), `createdAt`, `updatedAt`
- Step type enum: `background_check`, `insurance`, `certifications`, `training`, `stripe_connect`
- Step status enum: `pending`, `draft`, `in_progress`, `pending_review`, `complete`, `rejected`, `blocked`
- Rationale: Admin pipeline queries (FR40-42) require grouping providers by step status — `SELECT * FROM onboarding_steps WHERE stepType = 'insurance' AND status = 'pending_review'` is natural SQL. JSONB would require `jsonb_extract_path` operators for every pipeline query. The `draftData` JSONB handles session resumability (Cross-Cutting Concern #7) — stores partial form data per step without requiring additional tables. Fits existing pattern: every entity gets its own table.
- Affects: provider onboarding dashboard, admin pipeline view, all onboarding API endpoints

**Provider Documents (Decision 1.2)**
- Choice: Separate `provider_documents` table
- Schema: `id` (text PK), `providerId` (text, FK providers), `onboardingStepId` (text, FK onboarding_steps), `documentType` (enum: `insurance`, `certification`, `vehicle_doc`), `s3Key` (text), `originalFileName` (text), `fileSize` (integer, bytes), `mimeType` (text), `status` (enum: `pending_review`, `approved`, `rejected`), `rejectionReason` (text, nullable), `reviewedBy` (text, nullable), `reviewedAt` (timestamp, nullable), `expiresAt` (timestamp, nullable — insurance expiration), `createdAt`, `updatedAt`
- Rationale: Documents are first-class entities with their own review lifecycle (FR16-FR21). Multiple documents per step (e.g., multiple certifications). Admin needs to query "all documents pending review" — trivial with this table. `expiresAt` enables future insurance renewal tracking (Phase 2).
- Affects: document upload/review flow, admin pipeline, S3 integration

**Provider Table Extensions (Decision 1.3)**
- Choice: Extend existing `providerStatusEnum` with new values and add columns
- Enum additions: `applied`, `onboarding`, `pending_review`, `rejected`, `suspended` (existing `active`, `inactive`, `pending`, `resubmission_requested` preserved for backward compatibility)
- New columns on `providers` table:
  - `stripeConnectAccountId` (text, nullable) — Stripe Express account ID
  - `migrationBypassExpiresAt` (timestamp, nullable) — hard expiration for migration grace period
  - `activatedAt` (timestamp, nullable) — when provider became dispatchable
  - `suspendedAt` (timestamp, nullable) — when suspended
  - `suspendedReason` (text, nullable) — why suspended
  - `previousApplicationId` (text, nullable) — links reapplications to prior record
- Rationale: Extending the existing enum avoids a parallel status system. New columns are all nullable (no breaking changes to existing data). `stripeConnectAccountId` doubles as payout routing logic — no separate mode column needed. `migrationBypassExpiresAt` is a hard database-level expiration, deterministically testable.
- Affects: all provider queries, middleware, payout routing, migration flow

**Onboarding Step Initialization (Decision 1.4)**
- Choice: Create all step rows when provider enters onboarding (status `applied → onboarding`)
- On first step action: system creates 5 `onboarding_steps` rows (one per step type) with status `pending`
- Provider status transitions to `onboarding` (system-triggered, per State Transition Authority Matrix)
- Rationale: Pre-creating all rows enables the dashboard to show all steps immediately with their statuses. Avoids "does this step exist yet?" checks throughout the codebase.
- Affects: onboarding initialization logic, dashboard rendering

### Authentication & Security

**`requireOnboardingComplete` Middleware (Decision 2.1)**
- Choice: New middleware in `server/api/middleware/onboarding.ts`, chained after `requireProvider`
- Implementation: Checks provider's `status` column — if not `active`, checks `migrationBypassExpiresAt`. If bypass is set and `> NOW()`, allows through (logs bypass via `logAudit("onboarding.migration_bypass")`). Otherwise returns `403` with redirect to `/provider/onboarding`.
- Applied to: dispatch-gated provider routes — `/api/provider/jobs/*`, `/api/provider/earnings/*`, `/api/provider/stats/*`, `/api/provider/invoices/*`
- NOT applied to: `/api/provider/onboarding/*` (self-serve steps), `/api/provider/settings/*` (profile management), `/api/provider/observations/*` (active provider only, already gated by provider status)
- Middleware chain: `requireProvider` → `requireOnboardingComplete` (sequential `.use()` calls)
- Rationale: Defense-in-depth, same philosophy as Trust Tier enforcement. Bypass is database-timestamp-based (not config), auditable, and deterministically testable. Middleware separation follows existing pattern (`requireAuth`, `requireAdmin`, `requireProvider` are each their own middleware).
- Affects: all dispatch-gated provider routes

**Background Check Data Handling (Decision 2.2)**
- Choice: Minimal storage per FCRA — status + external IDs only
- Stored in `onboarding_steps.metadata` JSONB for the `background_check` step: `{ checkrCandidateId: string, checkrReportId: string, checkrInvitationId: string }`
- Status mapped from Checkr to step status: Checkr `pending` → step `in_progress`, Checkr `clear` → step `complete`, Checkr `consider` → step `pending_review` (admin adjudication), Checkr `suspended`/`adverse_action` → step `rejected`
- FCRA consent: recorded via `logAudit("onboarding.fcra_consent", { providerId, timestamp, ipAddress, consentVersion })` — immutable audit record, not a provider column
- Full reports NOT stored on platform — Checkr retains for 7 years per FCRA
- Rationale: NFR-S5 requires no PII beyond strict necessity. External IDs are safe to store and log. Consent as audit record is immutable by design (existing audit logger pattern). Admin can view full report via Checkr dashboard link (constructed from report ID).
- Affects: Checkr webhook handler, admin review UI, FCRA compliance

**Webhook Security (Decision 2.3)**
- Choice: Both Checkr and Stripe Connect webhooks validated in `server/api/routes/webhooks.ts`
- Checkr: HMAC signature validation (Checkr provides signing key via `X-Checkr-Signature` header)
- Stripe Connect: same `stripe.webhooks.constructEvent()` pattern already in codebase
- Both endpoints use existing rate-limit tier (200 req/min) and event deduplication via `processedEvents` Set
- Rationale: Centralized webhook handling in existing file. Same dedup and validation patterns.
- Affects: webhook route module (extend, not new file)

### API & Communication Patterns

**Checkr Integration (Decision 3.1)**
- Choice: Direct REST via `fetch` with typed wrapper in `server/api/lib/checkr.ts`
- API surface needed: `POST /v1/candidates` (create candidate), `POST /v1/invitations` (create invitation with package), `GET /v1/reports/{id}` (polling fallback), `POST /v1/adverse_actions` (admin-initiated adverse action)
- Wrapper exports: `createCandidate(data)`, `createInvitation(candidateId, package)`, `getReport(reportId)`, `createAdverseAction(reportId)`
- Auth: API key in `Authorization: Bearer ${CHECKR_API_KEY}` header
- Environments: `CHECKR_API_KEY` (production), `CHECKR_API_KEY_SANDBOX` (development/testing)
- Rationale: Checkr has no official maintained Node.js SDK. API surface is 4 endpoints — a thin typed wrapper is simpler and more maintainable than a third-party dependency. Matches the pattern of keeping external service logic in `server/api/lib/`. All calls include retry with progressive delay (NFR-I4).
- Affects: background check initiation, polling fallback job, admin adverse action

**Stripe Connect Express (Decision 3.2)**
- Choice: Use existing `stripe` package (v20.3.0) — Connect API is included
- Key operations:
  - `stripe.accounts.create({ type: 'express' })` — create connected account
  - `stripe.accountLinks.create({ account, return_url, refresh_url, type: 'account_onboarding' })` — generate onboarding link
  - `stripe.accounts.retrieve(accountId)` — polling fallback (check `details_submitted`, `charges_enabled`)
  - `stripe.transfers.create({ destination: accountId })` — payout to connected account
- Payout routing: `provider.stripeConnectAccountId ? automated via Transfer : manual batch` — no mode column
- Webhook: `account.updated` event handler in `webhooks.ts` — updates onboarding step status when `charges_enabled` flips to `true`
- Return flow: provider redirects back to `/provider/onboarding?stripe=complete`, page triggers status check API call
- Rationale: No new dependency. Stripe SDK already installed. Payout routing via account existence eliminates temporary scaffolding columns. Return detection + abandonment reminders (24h, 72h) handle redirect-flow resilience.
- Affects: onboarding flow, payout calculator extension, webhook handler extension

**New API Route Modules (Decision 3.3)**

| Module | Path | Middleware | Purpose |
|---|---|---|---|
| `onboarding.ts` | `/api/provider/onboarding` | `requireProvider` | Dashboard data, step actions, upload URLs, training completion, Stripe link generation, background check consent |
| (extend) `admin-providers.ts` | `/api/admin/providers` | `requireAdmin` | Pipeline view, document review, activation, rejection, adjudication |
| (extend) `webhooks.ts` | `/api/webhooks` | (none — signature validation) | Checkr webhook handler alongside existing Stripe webhooks |

- Rationale: 1 new module + 2 extensions is minimal surface area. All provider-facing onboarding endpoints go through a single route module. Admin endpoints extend the existing `admin-providers.ts` which already handles provider management. Webhooks centralized in existing file.

**Polling Fallback Jobs (Decision 3.4)**
- Choice: Two scheduled reconciliation functions, triggered via API endpoint (admin-callable) or future cron
- `reconcileCheckrStatuses()` — queries `onboarding_steps` where `stepType = 'background_check'` and `status = 'in_progress'` and `updatedAt < NOW() - 24h`. Calls `checkr.getReport()` for each. Updates status if changed.
- `reconcileStripeConnectStatuses()` — queries providers where `stripeConnectAccountId IS NOT NULL` and related onboarding step `status != 'complete'` and `updatedAt < NOW() - 4h`. Calls `stripe.accounts.retrieve()` for each.
- Both run in `server/api/lib/reconciliation.ts` — callable from admin endpoint or future scheduler
- Rationale: NFR-I2 requires no provider stuck > 28 hours due to missed webhook. NFR-I3 covers Stripe. Polling as reconciliation (not primary) keeps webhook as the happy path. Admin can trigger manually if needed.
- Affects: background check flow, Stripe Connect flow, admin tools

### Frontend Architecture

**Provider Onboarding Dashboard (Decision 4.1)**
- Choice: Card-per-step layout in `app/(provider)/provider/onboarding/page.tsx`
- Each step rendered as a tappable card with: icon, step name, status badge, primary action button
- Status badges: `Not Started` (gray), `In Progress` (blue), `Pending Review` (yellow), `Approved` (green), `Rejected` (red with reason), `Blocked` (gray, disabled)
- Steps can be completed in any order — no enforced sequence in UI
- WebSocket subscription on mount for real-time step status updates
- Rationale: PRD specifies mobile-first card-per-step (Responsive Design Requirements). Matches existing provider portal pattern (server component page → client component with fetch).

**Admin Pipeline View (Decision 4.2)**
- Choice: Extend existing admin providers page with pipeline grouping
- Pipeline stages rendered as columns or tabs: Applied, Documents Pending, Background Check, Stripe Setup, Training, Ready for Review, Active
- Each provider card shows: name, application date, steps completed count, next action needed
- Click-through to full provider onboarding detail with document review capability
- Rationale: Extends existing `admin-providers` page rather than creating a separate onboarding admin page. Keeps admin navigation simple.

### Infrastructure & Deployment

**No new infrastructure.** Same Docker multi-stage build, same Coolify deployment, same PostgreSQL instance, same S3 bucket.

**New environment variables:**
- `CHECKR_API_KEY` — production Checkr API key
- `CHECKR_API_KEY_SANDBOX` — sandbox key for development
- `CHECKR_WEBHOOK_SECRET` — HMAC signing key for webhook validation

**Database migrations:** 2 new tables (`onboarding_steps`, `provider_documents`), 1 enum extension (`providerStatusEnum`), 6 new columns on `providers`. Generated via `drizzle-kit generate` + manual review.

### Decision Impact Analysis

**Implementation Sequence (dependency-ordered):**
1. Schema changes — extend `providerStatusEnum`, add provider columns, create `onboarding_steps` + `provider_documents` tables
2. `requireOnboardingComplete` middleware — gates dispatch routes
3. Onboarding dashboard skeleton — provider-facing UI shell with step cards
4. Admin pipeline UI — provider grouping by stage, document review
5. Checkr integration — API wrapper + webhook handler + polling fallback
6. Stripe Connect integration — account creation + onboarding link + webhook + payout routing
7. Document upload flows — S3 presigned URLs + upload UI + admin review
8. Training module v1 — policy acknowledgment cards
9. Migration flow — existing provider migration dashboard + notification cadence

**Cross-Component Dependencies:**
- Schema (1) → everything else
- Middleware (2) → must exist before provider routes are modified
- Checkr (5) → independent of Stripe (6), can be parallel
- Stripe (6) → depends on payout routing decision (implicit from schema)
- Document uploads (7) → depends on admin review UI (4)
- Training (8) → independent, can be parallel with 5-7
- Migration (9) → depends on all prior work

## Provider Onboarding — Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

**8 conflict areas** specific to Provider Onboarding where AI agents could make inconsistent choices. All existing patterns from the original architecture (12 conflict areas, 127 project-context rules) remain in effect. These patterns address the **gaps** introduced by the onboarding feature.

### Naming Patterns

**New Database Tables & Columns:**

| Pattern | Convention | Example |
|---|---|---|
| Onboarding step types | snake_case enum values matching step concept | `background_check`, `stripe_connect`, NOT `backgroundCheck` or `stripeSetup` |
| Step status values | snake_case, progress-oriented | `pending`, `draft`, `in_progress`, `pending_review`, `complete`, `rejected`, `blocked` |
| Provider status extensions | snake_case, lifecycle-oriented | `applied`, `onboarding`, `pending_review`, `rejected`, `suspended` |
| Document types | snake_case noun | `insurance`, `certification`, `vehicle_doc` |
| Document statuses | snake_case, review-oriented | `pending_review`, `approved`, `rejected` |
| External IDs | camelCase column, prefixed with service name concept | `checkrCandidateId`, `checkrReportId`, `stripeConnectAccountId` |
| Bypass timestamps | camelCase, descriptive with `At` suffix | `migrationBypassExpiresAt`, `activatedAt`, `suspendedAt` |

**New Audit Actions:**

Follow existing `entity.verb_noun` pattern:

```
onboarding.step_started | onboarding.step_completed | onboarding.step_rejected
onboarding.fcra_consent | onboarding.migration_bypass
onboarding.activated | onboarding.suspended | onboarding.rejected
document.uploaded | document.approved | document.rejected | document.resubmitted
checkr.candidate_created | checkr.report_received | checkr.adjudication_approved
stripe_connect.account_created | stripe_connect.onboarding_completed | stripe_connect.link_generated
training.card_acknowledged | training.module_completed
migration.initiated | migration.completed | migration.suspended_deadline
```

**New WebSocket Events:**

Follow existing `entity:action` pattern:

| Event | Direction | Payload |
|---|---|---|
| `onboarding:step_updated` | Server → Provider | `{ providerId, stepType, newStatus, rejectionReason? }` |
| `onboarding:document_reviewed` | Server → Provider | `{ providerId, documentType, status, rejectionReason? }` |
| `onboarding:activated` | Server → Provider + Admins | `{ providerId, providerName }` |
| `onboarding:new_submission` | Server → Admins | `{ providerId, providerName, stepType }` |
| `onboarding:ready_for_review` | Server → Admins | `{ providerId, providerName }` |
| `migration:reminder_sent` | Server → Admins | `{ providerId, dayNumber, channel }` |

### Structure Patterns

**Onboarding Feature File Organization:**

```
db/schema/onboarding-steps.ts           → Onboarding steps table + enums
db/schema/provider-documents.ts          → Provider documents table + enum
db/schema/providers.ts                   ← MODIFY (extend enum, add columns)
db/schema/index.ts                       ← MODIFY (export new schemas)
server/api/routes/onboarding.ts          → Provider-facing onboarding endpoints
server/api/routes/admin-providers.ts     ← MODIFY (add pipeline + review endpoints)
server/api/routes/webhooks.ts            ← MODIFY (add Checkr webhook handler)
server/api/lib/checkr.ts                 → Checkr API wrapper (4 functions)
server/api/lib/reconciliation.ts         → Polling fallback jobs (Checkr + Stripe)
server/api/middleware/onboarding.ts      → requireOnboardingComplete middleware
lib/validators.ts                        ← MODIFY (add onboarding Zod schemas)
lib/constants.ts                         ← MODIFY (add onboarding constants)
app/(provider)/provider/onboarding/page.tsx           → Onboarding dashboard
app/(provider)/provider/onboarding/training/page.tsx  → Training module
app/(provider)/provider/onboarding/documents/page.tsx → Document uploads
components/onboarding/onboarding-dashboard.tsx        → Dashboard with step cards
components/onboarding/step-card.tsx                   → Individual step card
components/onboarding/document-uploader.tsx            → Mobile-first document capture
components/onboarding/document-preview.tsx             → Photo preview with retake
components/onboarding/training-cards.tsx               → Policy acknowledgment cards
components/onboarding/stripe-connect-button.tsx        → Stripe setup handoff
components/admin/provider-pipeline.tsx                 → Admin pipeline view
components/admin/document-review-modal.tsx             → Document review with zoom
```

**What NOT to create:**
- No `lib/onboarding/` directory — domain logic lives in route handlers or `server/api/lib/`
- No `types/onboarding.d.ts` — types co-located in schema files or inferred from Zod
- No `server/api/routes/checkr.ts` — Checkr webhooks go in existing `webhooks.ts`
- No `server/api/routes/provider-documents.ts` — document endpoints go in `onboarding.ts`
- No `components/provider/onboarding-*.tsx` — use dedicated `components/onboarding/` folder (onboarding is a distinct domain, not a provider sub-feature)

**Component folder rationale:** `components/onboarding/` gets its own folder (unlike observations/inspections which go in `components/provider/`) because onboarding is a temporary lifecycle phase with 6+ components that are never used outside the onboarding flow. After activation, these components are never rendered again.

### Format Patterns

**Onboarding API Response Formats:**

All onboarding endpoints follow existing response patterns:

| Scenario | Format | Example |
|---|---|---|
| Dashboard data | `c.json({ steps: OnboardingStep[], provider: ProviderSummary }, 200)` | Steps array with status per step |
| Step action | `c.json(updatedStep, 200)` | Return the updated step |
| Document upload URL | `c.json({ uploadUrl: string, s3Key: string, expiresIn: number }, 200)` | Presigned URL + metadata |
| Admin pipeline | `c.json({ stages: { [stage]: Provider[] }, total: number }, 200)` | Providers grouped by stage |
| Document review | `c.json(updatedDocument, 200)` | Return updated document with new status |
| Stripe link | `c.json({ url: string, expiresAt: string }, 200)` | Onboarding link URL |
| External service unavailable | `c.json({ error: "Background check service temporarily unavailable" }, 503)` | Graceful degradation per NFR-I7 |

**Onboarding Step Data Shape:**

```typescript
{
  id: string,
  providerId: string,
  stepType: "background_check" | "insurance" | "certifications" | "training" | "stripe_connect",
  status: "pending" | "draft" | "in_progress" | "pending_review" | "complete" | "rejected" | "blocked",
  draftData: Record<string, unknown> | null,  // partial progress
  metadata: Record<string, unknown> | null,    // step-specific (Checkr IDs, etc.)
  rejectionReason: string | null,
  completedAt: string | null,
  reviewedBy: string | null,
  reviewedAt: string | null,
  createdAt: string,
  updatedAt: string
}
```

### Communication Patterns

**Notification Triggers (Fire-and-Forget):**

| Trigger | Channels | Pattern |
|---|---|---|
| Application received | Email | `notifyApplicationReceived(providerId).catch(err => { console.error("[Notifications] Failed:", err); })` |
| Document approved | Email + Push | `notifyDocumentReviewed(providerId, docType, "approved").catch(...)` |
| Document rejected | Email + Push | `notifyDocumentReviewed(providerId, docType, "rejected", reason).catch(...)` |
| Background check cleared | Email + Push | `notifyBackgroundCheckResult(providerId, "clear").catch(...)` |
| Provider activated | Email + SMS + Push | `notifyProviderActivated(providerId).catch(...)` |
| Stripe setup reminder | Email + SMS | `notifyStripeSetupReminder(providerId, hoursElapsed).catch(...)` |
| Migration reminder | Email + SMS + Push | `notifyMigrationReminder(providerId, dayNumber).catch(...)` |
| Migration suspended | Email + SMS + Push | `notifyMigrationSuspended(providerId).catch(...)` |

### Process Patterns

**Onboarding State Machine Rules:**

```
Provider Status Transitions:
  applied → onboarding          (System: on first step action)
  onboarding → pending_review   (System: all steps complete)
  pending_review → active       (Admin: final review approval)
  pending_review → rejected     (Admin: with reason, required)
  rejected → applied            (Provider: reapply after cool-down)
  active → suspended            (Admin/System: policy violation or expired docs)
  suspended → onboarding        (Admin: reinstatement, re-complete failed steps)

Step Status Transitions:
  pending → draft               (Provider: starts step, saves partial data)
  pending → in_progress         (System: external process started, e.g., Checkr)
  draft → in_progress           (Provider: submits step for review/processing)
  draft → pending               (Provider: clears draft data)
  in_progress → pending_review  (System: ready for admin review)
  in_progress → complete        (System: auto-approved, e.g., Checkr clear)
  pending_review → complete     (Admin: approved)
  pending_review → rejected     (Admin: with reason)
  rejected → draft              (Provider: re-uploads/re-submits)
  rejected → pending            (System: resets step on reapplication)
```

**Enforcement must occur at:**
1. `requireOnboardingComplete` Hono middleware — checks provider status before dispatch-gated routes
2. Onboarding step action validators — Zod schemas validate step transitions are legal
3. Client-side UI — disable post-activation features for incomplete providers (UX only, not security)

**External Service Error Handling:**

| Scenario | Pattern |
|---|---|
| Checkr API down | Return `503` with `"Background check service temporarily unavailable"`. Log error. Provider can retry later. Step stays at current status. |
| Checkr webhook invalid signature | Return `401`. Log `checkr.webhook_invalid_signature` audit event. Do NOT process payload. |
| Checkr webhook duplicate event | Return `200` immediately. Skip processing. Use existing `processedEvents` Set pattern. |
| Stripe Connect account creation fails | Return `500` with `"Unable to set up payment account. Please try again."`. Log error with Stripe error code. |
| Stripe return URL hit but account not ready | Show "Setting up your account..." with polling check every 5 seconds (max 30 seconds). If still not ready, show "Almost done — we'll notify you when your account is ready." |
| S3 presigned URL generation fails | Return `500`. Log error. Provider sees "Upload temporarily unavailable." |
| Document upload fails (network) | Client retries 3x with progressive delay. After 3 failures: show "Upload failed. Please check your connection and try again." Queue for retry on `navigator.onLine`. |

**Loading & Data Fetching for Onboarding Pages:**

Follow existing pattern:

```tsx
// Server Component page.tsx — minimal
export default function OnboardingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Complete Your Onboarding</h1>
      <OnboardingDashboard />
    </div>
  );
}

// Client component — useEffect + fetch + WebSocket subscription
"use client";
export function OnboardingDashboard() {
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);
  // fetch from /api/provider/onboarding in useEffect
  // subscribe to WebSocket onboarding:step_updated events
}
```

### Enforcement Guidelines

**All AI Agents MUST (Provider Onboarding additions):**

1. Read `_bmad-output/project-context.md` first — 127 rules are non-negotiable (unchanged)
2. Follow the onboarding implementation sequence (schema → middleware → UI → integrations → migration)
3. Create all 5 onboarding step rows when a provider first enters onboarding — no lazy initialization
4. Use `logAudit()` for EVERY onboarding state transition — no exceptions
5. Use `logAudit()` for EVERY document review action — approve and reject
6. Record FCRA consent ONLY via `logAudit()` — never as a provider column
7. Store ONLY Checkr IDs in step metadata — never full report data (FCRA compliance)
8. Store ONLY `stripeConnectAccountId` on provider — never bank/SSN/tax data
9. Check `migrationBypassExpiresAt` against `NOW()` in middleware — never via cron or config
10. Apply `requireOnboardingComplete` to ALL dispatch-gated provider routes — no exceptions

**Anti-Patterns for Provider Onboarding:**

| DO NOT | INSTEAD |
|---|---|
| Store background check report content | Store only `checkrReportId` — admin views full report on Checkr dashboard |
| Create a `payoutMode` column on providers | Check `stripeConnectAccountId ? automated : manual` |
| Use localStorage for onboarding progress | Use `draftData` JSONB on `onboarding_steps` — cross-device continuity |
| Create separate webhook route for Checkr | Add handler in existing `webhooks.ts` alongside Stripe |
| Skip audit log for "minor" step updates | Log everything — every status change is auditable |
| Import Checkr SDK as npm dependency | Use typed wrapper in `server/api/lib/checkr.ts` with direct REST |
| Apply `requireOnboardingComplete` to onboarding routes | Onboarding routes use `requireProvider` only — providers must access them to complete onboarding |
| Create `components/provider/onboarding-*.tsx` | Use `components/onboarding/` — dedicated domain folder |
| Hard-code migration bypass duration | Use `migrationBypassExpiresAt` timestamp — database-level, auditable |
| Poll Checkr/Stripe as primary status update | Webhooks are primary — polling is reconciliation fallback only |

## Provider Onboarding — Project Structure & Boundaries

### Requirements to Structure Mapping

**7 FR Categories → File Locations:**

| FR Category | Schema | Route Module | Server Lib | Page(s) | Component(s) |
|---|---|---|---|---|---|
| 1. Application & Registration (FR1-FR6) | `db/schema/providers.ts` (extend) | `server/api/routes/onboarding.ts` | — | `app/(provider)/provider/onboarding/page.tsx` | `components/onboarding/onboarding-dashboard.tsx` |
| 2. Progress Management (FR7-FR12) | `db/schema/onboarding-steps.ts` | `server/api/routes/onboarding.ts` | — | `app/(provider)/provider/onboarding/page.tsx` | `components/onboarding/step-card.tsx` |
| 3. Document Upload & Review (FR13-FR21) | `db/schema/provider-documents.ts` | `server/api/routes/onboarding.ts` + extend `admin-providers.ts` | — | `app/(provider)/provider/onboarding/documents/page.tsx` | `components/onboarding/document-uploader.tsx`, `components/onboarding/document-preview.tsx`, `components/admin/document-review-modal.tsx` |
| 4. Background Check (FR22-FR28) | `db/schema/onboarding-steps.ts` (metadata JSONB) | `server/api/routes/onboarding.ts` + extend `webhooks.ts` | `server/api/lib/checkr.ts` | — (integrated in dashboard) | — (status shown on step card) |
| 5. Stripe Connect (FR29-FR35) | `db/schema/providers.ts` (stripeConnectAccountId) | `server/api/routes/onboarding.ts` + extend `webhooks.ts` | extend `payout-calculator.ts` | — (integrated in dashboard) | `components/onboarding/stripe-connect-button.tsx` |
| 6. Training (FR36-FR39) | `db/schema/onboarding-steps.ts` (draftData JSONB) | `server/api/routes/onboarding.ts` | — | `app/(provider)/provider/onboarding/training/page.tsx` | `components/onboarding/training-cards.tsx` |
| 7. Admin Pipeline (FR40-FR45) | (reads from onboarding_steps + provider_documents) | extend `server/api/routes/admin-providers.ts` | — | extend `app/(admin)/admin/providers/page.tsx` | `components/admin/provider-pipeline.tsx` |
| 8. Migration (FR46-FR51) | `db/schema/providers.ts` (migrationBypassExpiresAt) | `server/api/routes/onboarding.ts` | `server/api/lib/reconciliation.ts` | `app/(provider)/provider/onboarding/page.tsx` (conditional rendering) | — (same dashboard, filtered steps) |
| 9. Payout Transition (FR52-FR54) | `db/schema/providers.ts` (stripeConnectAccountId) | — (implicit routing in existing payout flow) | extend `server/api/lib/payout-calculator.ts` | — | — |
| 10. Notifications (FR55-FR59) | — | — (triggered from other route handlers) | extend `lib/notifications/` | — | — |

### Complete Project Directory Structure

New files marked with `← NEW`. Modified files marked with `← MODIFY`.

```
road-side-atl/
├── app/
│   ├── (provider)/
│   │   └── provider/
│   │       ├── onboarding/
│   │       │   ├── page.tsx                          ← NEW (onboarding dashboard)
│   │       │   ├── training/
│   │       │   │   └── page.tsx                      ← NEW (training module)
│   │       │   └── documents/
│   │       │       └── page.tsx                      ← NEW (document uploads)
│   │       ├── ... (existing: jobs, settings, invoices, earnings)
│   │
│   ├── (admin)/
│   │   └── admin/
│   │       ├── providers/
│   │       │   └── page.tsx                          ← MODIFY (add pipeline view tab/section)
│   │       ├── ... (existing admin pages)
│   │
│   ├── ... (existing: (marketing), (dashboard), (auth), api/, layout.tsx)
│
├── components/
│   ├── onboarding/                                   ← NEW FOLDER
│   │   ├── onboarding-dashboard.tsx                  ← NEW (step cards grid, WebSocket subscription)
│   │   ├── step-card.tsx                             ← NEW (individual step with status + action)
│   │   ├── document-uploader.tsx                     ← NEW (mobile camera capture + upload)
│   │   ├── document-preview.tsx                      ← NEW (photo preview with retake/submit)
│   │   ├── training-cards.tsx                        ← NEW (policy acknowledgment card UI)
│   │   ├── stripe-connect-button.tsx                 ← NEW (Stripe setup handoff + return detection)
│   │   └── migration-banner.tsx                      ← NEW (migration deadline countdown for existing providers)
│   │
│   ├── admin/
│   │   ├── provider-pipeline.tsx                     ← NEW (pipeline view grouped by stage)
│   │   ├── document-review-modal.tsx                 ← NEW (document view + zoom + approve/reject)
│   │   ├── onboarding-detail-panel.tsx               ← NEW (full onboarding checklist for one provider)
│   │   ├── sidebar.tsx                               ← MODIFY (add onboarding pipeline nav item)
│   │   ├── admin-mobile-nav.tsx                      ← MODIFY (add onboarding pipeline nav item)
│   │   ├── ... (existing admin components)
│   │
│   ├── ... (existing: booking, dashboard, maps, marketing, notifications, provider, reviews, ui)
│
├── server/
│   ├── api/
│   │   ├── index.ts                                  ← MODIFY (register onboarding route module)
│   │   ├── routes/
│   │   │   ├── onboarding.ts                         ← NEW (provider-facing: dashboard, steps, uploads, training, Stripe link, consent)
│   │   │   ├── admin-providers.ts                    ← MODIFY (add: pipeline view, document review, activation, rejection, adjudication)
│   │   │   ├── webhooks.ts                           ← MODIFY (add: Checkr webhook handler, Stripe account.updated handler)
│   │   │   ├── ... (existing: 27 route modules)
│   │   │
│   │   ├── middleware/
│   │   │   ├── onboarding.ts                         ← NEW (requireOnboardingComplete)
│   │   │   ├── auth.ts                               # Existing
│   │   │   ├── rate-limit.ts                         # Existing
│   │   │   └── trust-tier.ts                         # Existing
│   │   │
│   │   └── lib/
│   │       ├── checkr.ts                             ← NEW (Checkr REST API wrapper — createCandidate, createInvitation, getReport, createAdverseAction)
│   │       ├── reconciliation.ts                     ← NEW (polling fallback — reconcileCheckrStatuses, reconcileStripeConnectStatuses)
│   │       ├── audit-logger.ts                       ← MODIFY (add onboarding audit action types)
│   │       ├── payout-calculator.ts                  ← MODIFY (Stripe Connect transfer routing)
│   │       ├── ... (existing: auto-dispatch, rate-limiter, trust-tier, pricing-engine, etc.)
│   │
│   └── websocket/
│       ├── types.ts                                  ← MODIFY (add onboarding event types)
│       └── ... (existing WebSocket files)
│
├── db/
│   ├── schema/
│   │   ├── onboarding-steps.ts                       ← NEW (onboarding_steps table + stepType + stepStatus enums)
│   │   ├── provider-documents.ts                     ← NEW (provider_documents table + documentType + documentStatus enums)
│   │   ├── providers.ts                              ← MODIFY (extend providerStatusEnum, add 6 columns)
│   │   ├── index.ts                                  ← MODIFY (export new schemas)
│   │   ├── ... (existing: services, bookings, payments, users, etc.)
│   │
│   ├── migrations/                                   # Generated by drizzle-kit
│   └── index.ts                                      # Existing DB connection
│
├── lib/
│   ├── constants.ts                                  ← MODIFY (add ONBOARDING_STEP_TYPES, ONBOARDING_STATUSES, DOCUMENT_TYPES, TRAINING_TOPICS)
│   ├── validators.ts                                 ← MODIFY (add onboarding Zod schemas — application, document upload, training completion, admin review)
│   ├── notifications/
│   │   ├── index.ts                                  ← MODIFY (add onboarding notification dispatchers)
│   │   ├── sms.ts                                    ← MODIFY (add migration reminder, Stripe setup reminder templates)
│   │   ├── email.ts                                  ← MODIFY (add application received, document reviewed, activation templates)
│   │   └── push.ts                                   ← MODIFY (add onboarding step update push)
│   ├── ... (existing: auth, hooks, utils, stripe, logger)
│
├── ... (existing root config files unchanged)
```

### Architectural Boundaries

**API Boundaries:**

| Boundary | Enforced By | Routes |
|---|---|---|
| Provider onboarding endpoints | `requireProvider` | `/api/provider/onboarding/*` — any provider role, regardless of onboarding status |
| Dispatch-gated provider endpoints | `requireProvider` → `requireOnboardingComplete` | `/api/provider/jobs/*`, `/api/provider/earnings/*`, `/api/provider/stats/*`, `/api/provider/invoices/*` |
| Admin onboarding management | `requireAdmin` | `/api/admin/providers/pipeline/*`, `/api/admin/providers/:id/review/*` |
| Webhook endpoints | Signature validation (no auth middleware) | `/api/webhooks/checkr`, `/api/webhooks/stripe` (existing path) |
| Reconciliation endpoints | `requireAdmin` | `/api/admin/providers/reconcile` (manual trigger) |

**Component Boundaries:**

| Boundary | Rule |
|---|---|
| Onboarding components | `components/onboarding/` — only imported by `app/(provider)/provider/onboarding/` pages |
| Admin onboarding components | `components/admin/provider-pipeline.tsx`, `document-review-modal.tsx`, `onboarding-detail-panel.tsx` — only imported by `app/(admin)/admin/providers/` |
| Checkr API wrapper | `server/api/lib/checkr.ts` — NEVER imported outside `server/` |
| Reconciliation jobs | `server/api/lib/reconciliation.ts` — called by admin route handler only |
| Onboarding middleware | `server/api/middleware/onboarding.ts` — applied in route modules, never called from components |

**Data Boundaries:**

| Boundary | Rule |
|---|---|
| Onboarding step status | Always queried via `onboarding_steps` table — never computed from other data |
| Document review status | Always on `provider_documents.status` — never stored on step or provider |
| Background check data | Only `checkrCandidateId`, `checkrReportId`, `checkrInvitationId` in step metadata — never full report |
| Stripe Connect data | Only `stripeConnectAccountId` on providers — never bank/SSN/tax data |
| FCRA consent | Only via `logAudit()` — never as a provider column |
| Migration bypass | Only via `migrationBypassExpiresAt` timestamp — never via config/env var |
| Payout routing | Derived from `stripeConnectAccountId` existence — never from a mode column |

### Integration Points

**Internal Communication:**

```
Provider Onboarding Flow:
  onboarding-dashboard.tsx → GET /api/provider/onboarding → onboarding_steps query
                           → WebSocket subscribe onboarding:step_updated

Document Upload Flow:
  document-uploader.tsx → POST /api/provider/onboarding/upload-url → presigned S3 URL
                        → PUT [presigned URL] (direct to S3)
                        → POST /api/provider/onboarding/documents → provider_documents insert
                        → logAudit("document.uploaded")

Admin Document Review Flow:
  document-review-modal.tsx → GET /api/admin/providers/:id/documents → provider_documents query
                            → PATCH /api/admin/providers/:id/documents/:docId → update status
                            → logAudit("document.approved" | "document.rejected")
                            → WebSocket emit onboarding:document_reviewed
                            → notifyDocumentReviewed().catch(...)

Checkr Flow:
  POST /api/provider/onboarding/consent → logAudit("onboarding.fcra_consent")
                                        → checkr.createCandidate() → checkr.createInvitation()
                                        → onboarding_steps.metadata = { checkrCandidateId, checkrInvitationId }
                                        → logAudit("checkr.candidate_created")
  POST /api/webhooks/checkr → validate HMAC → dedup event
                             → update onboarding_steps status
                             → logAudit("checkr.report_received")
                             → WebSocket emit onboarding:step_updated
                             → notifyBackgroundCheckResult().catch(...)

Stripe Connect Flow:
  stripe-connect-button.tsx → POST /api/provider/onboarding/stripe-link
                            → stripe.accounts.create({ type: 'express' })
                            → stripe.accountLinks.create({ return_url, refresh_url })
                            → provider.stripeConnectAccountId = accountId
                            → logAudit("stripe_connect.account_created")
  Return URL → GET /api/provider/onboarding → detect stripe=complete query param
             → GET /api/provider/onboarding/stripe-status → stripe.accounts.retrieve()
  POST /api/webhooks/stripe (account.updated) → update onboarding_steps status
                                               → logAudit("stripe_connect.onboarding_completed")

Activation Flow:
  onboarding-detail-panel.tsx → PATCH /api/admin/providers/:id/activate
                              → verify all steps complete
                              → providers.status = 'active', activatedAt = NOW()
                              → logAudit("onboarding.activated")
                              → WebSocket emit onboarding:activated
                              → notifyProviderActivated().catch(...)

Payout Routing (modified):
  payout-calculator.ts → provider.stripeConnectAccountId ?
                          stripe.transfers.create({ destination: accountId }) :
                          existing manual batch flow
```

**External Integrations:**

| Service | Touch Points | New for Onboarding |
|---|---|---|
| Checkr | `server/api/lib/checkr.ts`, `webhooks.ts` | All new — background checks |
| Stripe Connect | `onboarding.ts`, `webhooks.ts`, `payout-calculator.ts` | Express accounts + transfers (extends existing Stripe) |
| S3 | `onboarding.ts` (presigned URLs), `upload.ts` (existing pattern) | Document uploads (extends existing pattern) |
| Twilio | `lib/notifications/sms.ts` | Migration reminders, Stripe setup reminders |
| Resend | `lib/notifications/email.ts` | Application received, document reviewed, activation |
| Web Push | `lib/notifications/push.ts` | Step status updates |

### New Files Summary

| Category | New Files | Modified Files |
|---|---|---|
| Schema | 2 | 2 |
| Route modules | 1 | 3 |
| Server libs | 2 | 2 |
| Middleware | 1 | 0 |
| Pages | 3 | 1 |
| Components | 10 | 2 |
| Shared libs | 0 | 6 |
| **Total** | **19 new files** | **16 modified files** |

## Provider Onboarding — Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** All 9 architectural decisions are compatible. No new frameworks introduced — Checkr integration is direct REST (no SDK dependency). Stripe Connect uses existing `stripe@20.3.0` package. All new schema follows Drizzle patterns. `requireOnboardingComplete` middleware follows identical pattern to existing `requireProvider`/`requireAdmin`/`validatePaymentMethod`. Payout routing via `stripeConnectAccountId` existence avoids any column conflicts with existing payout flow.

**Pattern Consistency:** All 8 new naming conflict areas resolved with conventions extracted from existing codebase. New audit actions follow existing `entity.verb_noun` pattern. New WebSocket events follow existing `entity:action` pattern. New API responses follow existing format patterns. `components/onboarding/` is the only new top-level component folder — justified by the distinct lifecycle domain with 7 components.

**Structure Alignment:** 19 new files placed in existing directory hierarchy with 1 new component folder. All boundaries respect existing middleware → route → component domain mapping. Server-side utilities in `server/api/lib/` consistent with existing patterns. Webhook handlers centralized in existing `webhooks.ts`.

### Requirements Coverage

**FR Coverage: 59/59 (100%)**

| Category | FR Count | Covered | Architecture Decisions |
|---|---|---|---|
| Application & Registration (FR1-FR6) | 6 | 6/6 | Provider table extensions, onboarding.ts route |
| Progress Management (FR7-FR12) | 6 | 6/6 | `onboarding_steps` table, WebSocket events, `requireOnboardingComplete` middleware |
| Document Upload & Review (FR13-FR21) | 9 | 9/9 | `provider_documents` table, S3 presigned URLs, admin review modal |
| Background Check (FR22-FR28) | 7 | 7/7 | Checkr REST wrapper, webhook handler, polling fallback, admin adjudication |
| Stripe Connect (FR29-FR35) | 7 | 7/7 | `stripeConnectAccountId`, Stripe Connect API, return detection, abandonment reminders |
| Training (FR36-FR39) | 4 | 4/4 | `onboarding_steps.draftData` JSONB, training cards UI |
| Admin Pipeline (FR40-FR45) | 6 | 6/6 | Pipeline view component, document review modal, activation endpoint |
| Migration (FR46-FR51) | 6 | 6/6 | `migrationBypassExpiresAt`, conditional dashboard, notification cadence |
| Payout Transition (FR52-FR54) | 3 | 3/3 | `stripeConnectAccountId` existence check in payout calculator |
| Notifications (FR55-FR59) | 5 | 5/5 | Notification extensions (email, SMS, push) for all onboarding events |

**NFR Coverage: 29/29 (100%)**

| Category | NFR Count | Covered | Key Pattern |
|---|---|---|---|
| Performance (NFR-P1 to P7) | 7 | 7/7 | SSR dashboard, presigned URL generation, Stripe link generation, WebSocket real-time, admin pipeline pagination |
| Security (NFR-S1 to S10) | 10 | 10/10 | S3 encryption at rest, presigned URL expiry, FCRA consent via audit log, minimal PII storage, HMAC webhook validation, file content inspection, document access scoping, audit trail |
| Scalability (NFR-SC1 to SC5) | 5 | 5/5 | 10 concurrent providers, 30 migration burst, polling job batch handling, S3 linear scaling |
| Integration Reliability (NFR-I1 to I7) | 7 | 7/7 | Checkr webhook 99.9%, polling fallback (24h Checkr, 4h Stripe), retry with progressive delay, fast webhook return, zero orphaned states, graceful degradation |

**Orphaned Requirements:** 0 | **Over-engineered Decisions:** 0

### Gap Analysis

**Critical Gaps:** None.

**Minor Enhancement Suggestions (non-blocking):**
1. **Observability** — No monitoring dashboards defined for Checkr API failures, Stripe Connect drop-off rates, or migration progress. `logAudit()` captures the data; dashboards are post-MVP.
2. **Admin notification preferences** — FR45/FR58/FR59 specify admin notifications but don't address notification fatigue if pipeline volume increases. Phase 2 concern (bulk tools threshold is 20 concurrent).
3. **Document version history** — Current design replaces documents on re-upload (rejected → re-submit creates new `provider_documents` row). Previous rejected documents remain in table with `rejected` status, providing implicit version history. Explicit versioning is a Phase 2 enhancement.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Provider Onboarding PRD thoroughly analyzed (59 FRs, 29 NFRs)
- [x] Scale and complexity assessed (Medium-High, 2 external services)
- [x] Technical constraints identified (FCRA, Stripe Connect KYC, Georgia towing regs)
- [x] Cross-cutting concerns mapped (7 concerns including Party Mode refinements)
- [x] State transition authority matrix defined

**Architectural Decisions**
- [x] Critical decisions documented with rationale (9 decisions)
- [x] Technology stack specified (Checkr direct REST, Stripe Connect via existing SDK)
- [x] Integration patterns defined (webhook + polling + manual for each service)
- [x] Performance considerations addressed (SSR, presigned URLs, WebSocket)
- [x] Security patterns specified (FCRA compliance, HMAC validation, PII minimization)

**Implementation Patterns**
- [x] Naming conventions established (database, API, code, audit actions, WebSocket events)
- [x] Structure patterns defined (19 new files, 16 modified, 1 new component folder)
- [x] Communication patterns specified (WebSocket events, notifications, fire-and-forget)
- [x] Process patterns documented (state machine rules, external service error handling, loading patterns)
- [x] Anti-patterns documented (10 anti-patterns specific to Provider Onboarding)

**Project Structure**
- [x] Complete directory structure defined (19 new, 16 modified)
- [x] Component boundaries established (API, component, data)
- [x] Integration points mapped (6 internal flows, 6 external services)
- [x] Requirements to structure mapping complete (10 FR categories → file locations)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Defense-in-depth onboarding enforcement (`requireOnboardingComplete` + state machine + audit trail)
- FCRA compliance by design — consent via immutable audit, minimal PII storage, no full report retention
- Split resilience pattern (async-webhook vs. redirect-flow) matches actual failure profiles of Checkr vs. Stripe
- Implicit payout routing (`stripeConnectAccountId` existence) eliminates temporary scaffolding cleanup
- Migration bypass with hard database timestamp — deterministically testable, auto-expires
- Session resumability via `draftData` JSONB — mobile providers can pause and resume
- Normalized `onboarding_steps` table — admin pipeline queries are natural SQL, not JSONB gymnastics
- Full backward compatibility — existing provider data and flows untouched

**Areas for Future Enhancement:**
- Observability dashboards for onboarding funnel metrics (post-MVP)
- Bulk admin review tools when concurrent > 20 (Phase 2)
- Automated insurance expiration tracking and renewal alerts (Phase 2)
- Onboarding analytics dashboard for funnel optimization (Phase 2)

### Implementation Handoff

**AI Agent Guidelines:**
1. Read `_bmad-output/project-context.md` first — 127 rules are mandatory
2. Read the ENTIRE architecture document (original + Provider Onboarding extension) before writing any code
3. Follow implementation sequence: schema → middleware → dashboard skeleton → admin pipeline → Checkr → Stripe Connect → documents → training → migration
4. Every state change gets `logAudit()` — no exceptions
5. Every new endpoint gets auth middleware — no exceptions
6. FCRA consent ONLY via `logAudit()` — never as a provider column
7. Background check data: ONLY Checkr IDs — never full report content
8. Payout routing: check `stripeConnectAccountId` existence — no mode column

**First Implementation Step:**
1. Extend `providerStatusEnum` in `db/schema/providers.ts` with `applied`, `onboarding`, `pending_review`, `rejected`, `suspended`
2. Add columns: `stripeConnectAccountId`, `migrationBypassExpiresAt`, `activatedAt`, `suspendedAt`, `suspendedReason`, `previousApplicationId`
3. Create `db/schema/onboarding-steps.ts` with step type and status enums
4. Create `db/schema/provider-documents.ts` with document type and status enums
5. Export new schemas from `db/schema/index.ts`
6. Run `npm run db:generate` + `npm run db:migrate`
7. Implement `server/api/middleware/onboarding.ts` (`requireOnboardingComplete`)

---

## Mobile Mechanics + Beta + Mobile Parity — Extension

_This section extends the architecture document with decisions specific to the Mobile Mechanics service category, 2-month open beta (Apr 7 – Jun 7, 2026), and mobile app parity initiative (PRD: `prd-mobile-mechanics-beta.md`, 41 FRs, 13 NFRs). All existing architectural decisions above remain in effect._

## Mobile Mechanics — Project Context Analysis

### Requirements Overview

**Functional Requirements:**
41 FRs across 6 capability areas: Mechanics Service Category (FR-1), Beta Mode (FR-2), Mechanic Dispatch (FR-3), Observation Upsell (FR-4), Push Notifications (FR-5), Mobile App Parity (FR-6). The mechanics dispatch cron and beta trust-tier bypass are the most architecturally significant — they introduce time-based dispatch (vs. event-driven) and a conditional override to the Trust Tier security model.

**Non-Functional Requirements:**
13 NFRs. The idempotency requirement for mechanic dispatch cron (NFR-9) is the most architecturally constraining — the cron must be safe to re-run without double-dispatching.

**Scale & Complexity:**

- Primary domain: Brownfield feature expansion + cross-platform mobile
- Complexity level: Medium
- New external services: 1 (Expo Push API)
- New schema entities: 2 tables (`beta_users`, `device_tokens`), 1 enum value, 1 column
- New route modules: 1 (`beta.ts`)
- Modified route modules: 3 (`services.ts`, `bookings.ts`, `push.ts`)

### Technical Constraints & Dependencies

**New external service dependency:**
- **Expo Push API** — Push notification delivery to iOS/Android via Expo push tokens. Stateless HTTP API, no webhook. Batch sends supported (up to 100 tokens per request). Token format: `ExponentPushToken[...]`.

**No new locked dependencies.** Everything builds on existing stack:
- Cron: existing `server/cron.ts` pattern (node-cron)
- Enum migration: Drizzle-kit `ALTER TYPE ADD VALUE` (non-destructive)
- Config storage: existing `platform_settings` key-value table
- Notification dispatch: existing `lib/notifications/` pattern

**Critical architectural constraint:** The Trust Tier bypass for beta mode must NOT create a permanent security hole. The bypass is a runtime check (`isBetaActive()`), not a schema change. When beta ends, the original trust-tier logic resumes with zero code changes — just a `platform_settings` row update.

### Cross-Cutting Concerns

| Concern | Resolution |
|---|---|
| Beta trust-tier bypass audit trail | Log `beta_trust_bypass` action in audit logger when beta path taken |
| Mechanic dispatch idempotency | Cron checks `status = confirmed AND providerId IS NULL AND scheduledAt within 2hr window` — already-dispatched bookings are excluded |
| Push notification dual-channel | Notification dispatch checks token type (Expo vs VAPID) and routes accordingly |
| Observation upsell matching | Category-to-service mapping table or hardcoded map — keep simple for beta |

## Mobile Mechanics — Core Architectural Decisions

### Decision 1: Service Category Enum Extension

**Decision:** Add `"mechanics"` to existing `service_category` PostgreSQL enum.

**Why not a separate table?** The category is a simple classifier, not a rich entity. Enum aligns with existing `roadside` and `diagnostics` pattern. Adding a value is non-destructive — existing rows unaffected.

**Migration:** `ALTER TYPE service_category ADD VALUE 'mechanics'` via Drizzle-kit generated migration.

**Impact:** All queries filtering by category automatically include mechanics. No application code changes needed for existing category-based logic.

### Decision 2: Scheduling Mode Column

**Decision:** Add `schedulingMode` text column to `services` table with values `"immediate"` | `"scheduled"` | `"both"`, defaulting to `"both"`.

**Why text, not enum?** Three values that may expand. Enum migration for adding values is annoying in Postgres. Text with application-level validation (Zod) is sufficient. Existing services get `"both"` (backward compatible). Mechanic services get `"scheduled"`.

**Enforcement:** `POST /api/bookings` validates: if service `schedulingMode === "scheduled"` and `scheduledAt` is null, return 400.

### Decision 3: Beta Mode via Platform Settings

**Decision:** Use existing `platform_settings` key-value table for beta configuration. Three rows: `beta_mode_active`, `beta_start_date`, `beta_end_date`.

**Why not a dedicated table or config file?** The platform already has a `platform_settings` table used for trust tier config. Adding 3 rows is zero migration, zero schema change. Admin can toggle via existing settings UI pattern.

**Helper:** `server/api/lib/beta.ts` exports `isBetaActive(): Promise<boolean>` that reads `platform_settings`. Cached for 60 seconds to avoid per-request DB hits.

```typescript
// server/api/lib/beta.ts
let cachedBetaActive: boolean | null = null;
let cacheExpiry = 0;

export async function isBetaActive(): Promise<boolean> {
  if (cachedBetaActive !== null && Date.now() < cacheExpiry) return cachedBetaActive;
  const setting = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.key, "beta_mode_active"),
  });
  cachedBetaActive = setting?.value === "true";
  cacheExpiry = Date.now() + 60_000;
  return cachedBetaActive;
}
```

### Decision 4: Trust Tier Beta Bypass

**Decision:** Modify `getAllowedPaymentMethods()` in `server/api/lib/trust-tier.ts` to check `isBetaActive()` before applying tier logic.

**Pattern:**
```typescript
export async function getAllowedPaymentMethodsWithBeta(trustTier: number): Promise<readonly string[]> {
  if (await isBetaActive()) {
    return TIER_2_ALLOWED_METHODS; // All methods during beta
  }
  return trustTier >= 2 ? TIER_2_ALLOWED_METHODS : TIER_1_ALLOWED_METHODS;
}
```

**Audit:** When beta bypass is used, log `{ action: "beta_trust_bypass", userId }` via `logAudit()`.

**Rollback:** Set `beta_mode_active` to `"false"` in platform_settings. Function reverts to original tier logic. No code deployment needed.

### Decision 5: Mechanic Dispatch — Cron-Based Pre-Dispatch

**Decision:** Mechanic bookings are dispatched via cron job, not on booking confirmation.

**Why?** Mechanic bookings are always scheduled (could be days or weeks out). Immediate dispatch on confirm makes no sense — the provider needs to be matched close to the appointment time. A 2-hour pre-dispatch window gives providers time to prepare while ensuring availability.

**Cron pattern:** Every 15 minutes, query for bookings where:
- `status = 'confirmed'`
- `providerId IS NULL` (not yet dispatched)
- `scheduledAt` is within next 2 hours
- Service category is `mechanics`

Trigger existing `autoDispatchBooking()` for each match. The existing dispatch function already handles specialty matching via the `specialties` JSONB array.

**Idempotency:** Once dispatched, `providerId` is set and `status` changes to `dispatched`. The cron query excludes these automatically.

**Add to `server/cron.ts`:**
```typescript
// Mechanic pre-dispatch: every 15 minutes
cron.schedule("*/15 * * * *", async () => {
  const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const now = new Date();
  const pendingMechanicBookings = await db.query.bookings.findMany({
    where: and(
      eq(bookings.status, "confirmed"),
      isNull(bookings.providerId),
      gte(bookings.scheduledAt, now),
      lte(bookings.scheduledAt, twoHoursFromNow),
    ),
    with: { service: true },
  });
  for (const booking of pendingMechanicBookings.filter(b => b.service?.category === "mechanics")) {
    await autoDispatchBooking(booking.id).catch(err =>
      console.error(`[Mechanic Dispatch] Failed for booking ${booking.id}:`, err)
    );
  }
});
```

### Decision 6: Push Notification Dual-Channel Architecture

**Decision:** Extend notification dispatch to support both web-push (VAPID) and Expo Push API, routing by token type.

**Schema approach:** Add `tokenType` discriminator to `push_subscriptions` table OR create a new `device_tokens` table. Recommended: **new `device_tokens` table** — cleaner separation, different payload shapes (Expo token is a string, web-push subscription is a JSON object with endpoint + keys).

**`db/schema/device-tokens.ts`:**
```typescript
export const deviceTokens = pgTable("device_tokens", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expoPushToken: text("expoPushToken").notNull(),
  platform: text("platform").notNull(), // "ios" | "android"
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
```

**Dispatch logic in `lib/notifications/push.ts`:**
```typescript
export async function sendPushNotification(userId: string, payload: PushPayload) {
  // Web push (existing)
  const webSubs = await getWebPushSubscriptions(userId);
  for (const sub of webSubs) {
    webpush.sendNotification(sub, JSON.stringify(payload))
      .catch(err => console.error("[Push] Web push failed:", err));
  }
  // Expo push (new)
  const deviceTokens = await getDeviceTokens(userId);
  if (deviceTokens.length > 0) {
    await sendExpoPush(deviceTokens.map(t => t.expoPushToken), payload)
      .catch(err => console.error("[Push] Expo push failed:", err));
  }
}
```

**Expo Push API call pattern:** HTTP POST to `https://exp.host/--/api/v2/push/send` with batch of messages. Fire-and-forget with error logging — consistent with existing notification patterns.

### Decision 7: Observation → Mechanic Upsell Mapping

**Decision:** Hardcoded category-to-service mapping for beta. No new table.

**Why hardcoded?** Only ~6 mechanic services and ~8 observation categories. A mapping table adds migration overhead for a lookup that changes rarely. Revisit post-beta if the catalog grows.

**Map in `server/api/lib/observation-upsell.ts`:**
```typescript
const OBSERVATION_TO_MECHANIC_SERVICE: Record<string, string> = {
  "Brakes": "brake-service",
  "Battery": "battery-replace",
  "Belts": "belt-replacement",
  "AC/Cooling": "ac-repair",
  "Engine": "general-maintenance",
  "Fluids": "oil-change",
};
```

**Integration point:** In `POST /api/observations` handler, after saving observation, check for medium/high severity items. For each matching category, include a deep link to the booking form with `serviceSlug` and `vehicleInfo` query params in the follow-up SMS/email.

## Mobile Mechanics — Implementation Patterns

### Naming Patterns

| Entity | Convention | Example |
|---|---|---|
| Mechanic services | Kebab-case slugs | `oil-change`, `brake-service` |
| Beta settings keys | Snake_case | `beta_mode_active` |
| Cron job comments | `[Category] Description` | `[Mechanic Dispatch]` |
| Push notification types | `entity:action` | `booking:dispatched`, `provider:job_assigned` |
| Device token platform | Lowercase | `"ios"`, `"android"` |

### Structure Patterns

**New files follow existing directory hierarchy:**

| File | Location | Purpose |
|---|---|---|
| `beta.ts` | `server/api/lib/` | Beta mode helper |
| `observation-upsell.ts` | `server/api/lib/` | Category-to-service mapping |
| `beta-users.ts` | `db/schema/` | Beta user tracking table |
| `device-tokens.ts` | `db/schema/` | Expo push token storage |

**No new top-level directories.** No new middleware files. No new route group folders.

### Process Patterns

**Mechanic booking validation chain:**
1. Parse request body (Zod)
2. Fetch service → check `schedulingMode`
3. If `scheduled` and no `scheduledAt` → 400
4. If `scheduledAt` in the past → 400
5. Calculate price via existing `calculateBookingPrice()`
6. Create booking (existing flow)
7. If `isBetaActive()` → auto-enroll in `beta_users` (fire-and-forget)
8. Notify admin (existing flow)

**Beta enrollment pattern:**
```typescript
if (await isBetaActive()) {
  db.insert(betaUsers).values({
    userId: booking.userId,
    source: "booking",
  }).onConflictDoNothing() // Idempotent — same user booking twice doesn't duplicate
    .catch(err => console.error("[Beta] Enrollment failed:", err));
}
```

## Mobile Mechanics — Project Structure

### New Files Summary

| Category | New Files | Modified Files |
|---|---|---|
| Schema | 2 (`beta-users.ts`, `device-tokens.ts`) | 2 (`services.ts`, `index.ts`) |
| Server libs | 2 (`beta.ts`, `observation-upsell.ts`) | 1 (`trust-tier.ts`) |
| Route modules | 0 | 3 (`services.ts`, `bookings.ts`, `push.ts`) |
| Cron | 0 | 1 (`cron.ts`) |
| Notifications | 0 | 1 (`push.ts`) |
| Seed | 0 | 1 (`seed.ts`) |
| **Backend Total** | **4 new files** | **9 modified files** |

### Mobile App New Files (Expo/React Native)

| Category | New Files | Modified Files |
|---|---|---|
| Lib | 1 (`push.ts`) | 1 (`types.ts`) |
| Services feature | 0 | 1 (`services-screen.tsx`) |
| Bookings feature | 0 | 2 (`book-screen.tsx`, `api.ts`) |
| Provider feature | 2 (`observations-screen.tsx`, `inspection-report-screen.tsx`) | 1 (`api.ts`) |
| Referrals feature | 2 (`referrals-screen.tsx`, `api.ts`) | 0 |
| Components | 1 (`tracking-map.tsx`) | 0 |
| **Mobile Total** | **6 new files** | **5 modified files** |

### Integration Points

| System | File | Change |
|---|---|---|
| Trust tier | `server/api/lib/trust-tier.ts` | Add `isBetaActive()` check in payment method resolution |
| Auto-dispatch | `server/api/lib/auto-dispatch.ts` | No change — existing specialty matching works |
| Cron | `server/cron.ts` | Add mechanic pre-dispatch job (every 15 min) |
| Notifications | `lib/notifications/push.ts` | Add Expo push delivery alongside web-push |
| Observations | `server/api/routes/observations.ts` | Add upsell link generation in follow-up handler |
| Seed | `db/seed.ts` | Add 6 mechanic services + beta platform_settings rows |

## Mobile Mechanics — Architecture Validation

### Coherence Validation

**Decision compatibility:** All 7 decisions are compatible with existing architecture. No new dependencies except Expo Push API (stateless HTTP). Enum extension is non-destructive. Beta bypass is runtime-only with audit logging.

**Pattern consistency:** New files follow existing directory structure. Naming conventions match established patterns. Fire-and-forget notification pattern reused for push delivery.

**Security model integrity:** Trust tier bypass is explicitly scoped to beta period via `platform_settings` check with audit trail. No permanent security changes. Rollback is a single DB row update.

### Requirements Coverage

**FR Coverage: 41/41 (100%)**
- FR-1 (Mechanics category): Decisions 1, 2 + seed data
- FR-2 (Beta mode): Decisions 3, 4 + beta_users table
- FR-3 (Mechanic dispatch): Decision 5
- FR-4 (Observation upsell): Decision 7
- FR-5 (Push notifications): Decision 6
- FR-6 (Mobile parity): Mobile app file structure

**NFR Coverage: 13/13 (100%)**
- Performance: Cron <5s (simple query), push <3s (async), beta check cached 60s
- Security: Expo tokens tied to userId, beta bypass audited, JWT required for device registration
- Reliability: Cron idempotent, beta toggle atomic, push fire-and-forget
- Data: Beta users retained, enum migration non-destructive

### Implementation Handoff

**AI Agent Guidelines:**
1. Read full architecture document (original + Provider Onboarding + this extension) before writing any code
2. Follow implementation sequence: schema → beta helpers → cron → push → seed → mobile
3. Every beta bypass gets `logAudit()` — no exceptions
4. Mechanic dispatch cron must be idempotent — test by running twice
5. Expo push tokens: validate format (`ExponentPushToken[...]`) on registration
6. `schedulingMode` validation in bookings route — Zod schema, not middleware
7. Observation upsell mapping is hardcoded — do NOT create a DB table for it

**First Implementation Step:**
1. Add `"mechanics"` to `serviceCategoryEnum` in `db/schema/services.ts`
2. Add `schedulingMode` column to `services` table
3. Create `db/schema/beta-users.ts`
4. Create `db/schema/device-tokens.ts`
5. Export new schemas from `db/schema/index.ts`
6. Run `npm run db:generate` + `npm run db:push`
7. Create `server/api/lib/beta.ts` with cached `isBetaActive()`
8. Seed mechanic services and beta config rows

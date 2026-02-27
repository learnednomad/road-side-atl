---
stepsCompleted: ['step-01-init', 'step-02-context', 'step-03-starter', 'step-04-decisions', 'step-05-patterns', 'step-06-structure', 'step-07-validation', 'step-08-complete']
status: 'complete'
completedAt: '2026-02-12'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/prd-validation-report.md
  - _bmad-output/planning-artifacts/product-brief-road-side-atl-2026-02-11.md
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

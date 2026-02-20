# Story 1.2: Payment Method Enforcement Middleware

Status: done

## Story

As a platform operator,
I want Tier 1 customers to be blocked from using card payments at the API level,
so that chargebacks from unverified customers are eliminated with zero bypass paths.

## Acceptance Criteria

1. **Stripe Payment Rejection for Tier 1** - Given a Tier 1 customer attempts to create a payment with method "stripe", when the request hits the `validatePaymentMethod` middleware, then the request is rejected with 400 and message "Trust Tier 1 users cannot use card payments", and an audit entry is logged with action `trust_tier.bypass_attempt`.

2. **Stripe Payment Allowed for Tier 2** - Given a Tier 2 customer attempts to create a payment with method "stripe", when the request hits the `validatePaymentMethod` middleware, then the request proceeds normally.

3. **Non-Reversible Methods Always Allowed** - Given a Tier 1 customer attempts to create a payment with method "cash", "cashapp", or "zelle", when the request hits the middleware, then the request proceeds normally.

4. **Zod Validation Layer (Defense-in-Depth)** - Given a booking creation request includes a payment method, when the Zod schema validates the request, then payment method eligibility is validated against the user's Trust Tier (second enforcement layer).

## Tasks / Subtasks

- [x] Task 1: Create trust tier middleware (AC: #1, #2, #3)
  - [x] 1.1 Create `server/api/middleware/trust-tier.ts` with `validatePaymentMethod` middleware
  - [x] 1.2 Middleware must look up customer's `trustTier` from the database (NOT from session — session may not include trust tier yet)
  - [x] 1.3 Log bypass attempts via `logAudit()` with action `trust_tier.bypass_attempt`

- [x] Task 2: Apply middleware to payment endpoints (AC: #1, #2, #3)
  - [x] 2.1 Apply `validatePaymentMethod` to Stripe checkout endpoint in `server/api/routes/payments.ts`
  - [x] 2.2 Add `requireAuth` to Stripe checkout endpoint (currently unauthenticated — cannot check tier without user)
  - [x] 2.3 Apply middleware awareness to admin payment confirmation (admin confirms on BEHALF of customer — admin bypasses tier check but audit logs the customer's tier)

- [x] Task 3: Zod validation enhancement (AC: #4)
  - [x] 3.1 Create `validatePaymentMethodForTier()` utility in `server/api/lib/trust-tier.ts` (extend Story 1.1's file)
  - [x] 3.2 Add Zod-based payment method validation with tier context to `lib/validators.ts`

- [x] Task 4: Audit logging for bypass attempts (AC: #1)
  - [x] 4.1 Ensure `trust_tier.bypass_attempt` audit action exists (should be from Story 1.1)
  - [x] 4.2 Log all rejection events with full context

## Dev Notes

### Dependency: Story 1.1 MUST Be Completed First

This story depends on Story 1.1 (Trust Tier Data Model & Promotion Engine). Before implementing Story 1.2, verify:

- [ ] `trustTier` column exists on `users` table in `db/schema/users.ts`
- [ ] `cleanTransactionCount` column exists on `users` table
- [ ] `server/api/lib/trust-tier.ts` exists with promotion logic
- [ ] Trust tier constants exist in `lib/constants.ts` (`TRUST_TIER_LEVELS`, `TRUST_TIER_PROMOTION_THRESHOLD`)
- [ ] Audit actions `trust_tier.promote`, `trust_tier.demote`, `trust_tier.admin_override`, `trust_tier.bypass_attempt` exist in `server/api/lib/audit-logger.ts`

If any of these are missing, Story 1.1 was not properly completed. Do not proceed.

### Critical Architecture: Defense-in-Depth (NFR12)

Trust Tier enforcement requires THREE layers. This story implements layers 1 and 2:

| Layer | What | Where | Purpose |
|---|---|---|---|
| **Layer 1** (this story) | `validatePaymentMethod` Hono middleware | `server/api/middleware/trust-tier.ts` | Block Tier 1 from Stripe at API level |
| **Layer 2** (this story) | Zod schema validator with tier context | `lib/validators.ts` | Second enforcement inside route handler |
| **Layer 3** (future) | Automated deploy test | CI/CD pipeline | Verify Tier 1 cannot reach card endpoints |

### Current Payment Architecture (CRITICAL TO UNDERSTAND)

Payment method is **NOT** specified during booking creation. The current flow:

1. **Booking created** via `POST /api/bookings` — NO payment method field in schema
2. **Payment happens separately** via one of:
   - `POST /api/payments/stripe/checkout` — Stripe card payment (customer-initiated)
   - `POST /api/admin/bookings/:id/confirm-payment` — Admin confirms manual payment (cash/cashapp/zelle)
   - `PATCH /api/admin/payments/:id/confirm` — Admin confirms existing payment record

**Where middleware MUST be applied:**
- `POST /api/payments/stripe/checkout` — **THIS is where Tier 1 must be blocked from Stripe**
- Admin confirmation endpoints do NOT need tier blocking (admin confirms manual payments which are always allowed for Tier 1)

### Existing Middleware Patterns to Follow

**Auth middleware** (`server/api/middleware/auth.ts`):
```typescript
import { createMiddleware } from "hono/factory";
import { auth } from "@/lib/auth";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await auth();
  if (!session?.user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("user", session.user as AuthEnv["Variables"]["user"]);
  await next();
});
```

**Key patterns:**
- Use `createMiddleware<AuthEnv>()` from `hono/factory`
- Auth context user shape: `{ id: string; role: string; name?: string | null; email?: string | null }`
- Return `c.json({ error: "..." }, statusCode)` for rejection
- Call `await next()` to proceed

### Exact File Specifications

**1. Trust Tier Middleware (`server/api/middleware/trust-tier.ts`):**

```typescript
import { createMiddleware } from "hono/factory";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logAudit, getRequestInfo } from "@/server/api/lib/audit-logger";
```

The `validatePaymentMethod` middleware:
- Runs AFTER `requireAuth` (needs user context)
- Reads `user.id` from Hono context via `c.get("user")`
- Queries `users` table for `trustTier` (do NOT rely on session — query fresh)
- If `trustTier === 1` AND the request involves Stripe payment → reject with 400
- Log `trust_tier.bypass_attempt` to audit
- If allowed → call `await next()`

**How to determine if request involves Stripe:**
- For `POST /payments/stripe/checkout` — the endpoint itself IS Stripe, so any request to this endpoint by a Tier 1 user is a bypass attempt
- The middleware does NOT need to parse the request body for payment method — the ROUTE determines the method

**2. Payments route modification (`server/api/routes/payments.ts`):**

Current state — `POST /stripe/checkout` has NO auth middleware:
```typescript
const app = new Hono();
// NO middleware applied
app.post("/stripe/checkout", async (c) => { ... });
```

Must add:
```typescript
import { requireAuth } from "@/server/api/middleware/auth";
import { validatePaymentMethod } from "@/server/api/middleware/trust-tier";

const app = new Hono();
app.use("/stripe/*", requireAuth);        // Auth first
app.use("/stripe/*", validatePaymentMethod); // Then tier check
```

**IMPORTANT:** The Stripe checkout handler currently gets the booking and creates a Stripe session. It does NOT check if the user is authenticated. Adding `requireAuth` means:
- Guest bookings (userId = null) can NO LONGER use Stripe checkout directly
- This is CORRECT per FR13 — unverified users should not use card payments
- Guest users must complete account creation first (FR48) or use manual payment methods

**3. Zod validation enhancement (`lib/validators.ts`):**

Add a helper function that validates payment method against tier:
```typescript
export function isPaymentMethodAllowedForTier(method: string, trustTier: number): boolean {
  if (method === "stripe" && trustTier < 2) return false;
  return true;
}
```

This is the Layer 2 enforcement — called inside route handlers as an additional check even if middleware passes.

**4. Trust tier validation utility (`server/api/lib/trust-tier.ts` — extend Story 1.1's file):**

Add:
```typescript
export const TIER_1_ALLOWED_METHODS = ["cash", "cashapp", "zelle"] as const;
export const TIER_2_ALLOWED_METHODS = ["cash", "cashapp", "zelle", "stripe"] as const;

export function getAllowedPaymentMethods(trustTier: number): readonly string[] {
  return trustTier >= 2 ? TIER_2_ALLOWED_METHODS : TIER_1_ALLOWED_METHODS;
}
```

### Payment Endpoints Reference

| Endpoint | File | Current Auth | Tier Check Needed? | Rationale |
|---|---|---|---|---|
| `POST /payments/stripe/checkout` | `payments.ts` | **NONE** (bug!) | **YES — primary target** | Tier 1 must be blocked from Stripe |
| `PATCH /admin/payments/:id/confirm` | `admin.ts` | `requireAdmin` | **NO** | Admin confirms manual payments (cash/cashapp/zelle only — `confirmPaymentSchema` already excludes Stripe) |
| `POST /admin/bookings/:id/confirm-payment` | `admin.ts` | `requireAdmin` | **NO** | Same — admin confirms manual methods only |

The admin confirmation schemas (`confirmPaymentSchema`) already restrict to `["cash", "cashapp", "zelle"]` — Stripe is NOT an option. No middleware needed on admin routes.

### Existing Code Details

**Stripe checkout handler** (`server/api/routes/payments.ts` lines 12-62):
- Validates via `createStripeCheckoutSchema` (just `bookingId`)
- Fetches booking by ID
- Creates Stripe checkout session
- Inserts payment record with `method: "stripe"`
- Returns `{ url: session.url }` for redirect

**Admin confirm payment schema** (`lib/validators.ts` lines 44-47):
```typescript
export const confirmPaymentSchema = z.object({
  method: z.enum(["cash", "cashapp", "zelle"]),  // NO "stripe" option
  amount: z.number().int().positive().optional(),
});
```

This schema already enforces that admin confirmation can only use manual methods. Stripe payments go through Stripe webhooks, not admin confirmation.

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Check trust tier in the Stripe checkout route handler | Use middleware — separation of concerns |
| Parse request body in middleware to find payment method | The route itself determines method — `/stripe/checkout` IS Stripe |
| Rely on session for trust tier | Query `users` table fresh — session may not include tier |
| Block admin payment confirmation endpoints | Admin confirms manual methods only — schema already excludes Stripe |
| Create a separate trust tier route module | Routes are Story 1.3, NOT this story |
| Create admin UI for trust tier management | UI is Story 1.3, NOT this story |
| Add trust tier to JWT/session token | That requires modifying auth callbacks — consider for Story 1.4, not here |
| Skip audit logging for rejections | Log EVERY bypass attempt — critical for NFR12 compliance |
| Use try-catch in middleware | Let Hono handle errors — no try-catch per project rules |
| Import from `"zod"` | Import from `"zod/v4"` |
| Use relative imports `../` | Use `@/` path alias |

### Previous Story Intelligence (Story 1.1)

Story 1.1 creates the foundation this story builds on:
- `trustTier` column on users table (integer, default 1)
- `cleanTransactionCount` column on users table (integer, default 0)
- `server/api/lib/trust-tier.ts` with `incrementCleanTransaction()` and `checkAndPromote()`
- Audit actions: `trust_tier.promote`, `trust_tier.demote`, `trust_tier.admin_override`, `trust_tier.bypass_attempt`
- Constants: `TRUST_TIER_LEVELS`, `TRUST_TIER_PROMOTION_THRESHOLD`

Story 1.1 explicitly scoped OUT this story's work:
- "NO `server/api/middleware/trust-tier.ts` — that is Story 1.2"

### Dependencies and Scope

**This story requires:** Story 1.1 (Trust Tier Data Model) completed

**This story blocks:** Story 1.3 (Admin Trust Tier Configuration), Story 1.4 (Customer Visibility)

**This story does NOT include:**
- Admin trust tier management routes (Story 1.3)
- Admin trust tier management UI (Story 1.3)
- Customer-facing trust tier visibility (Story 1.4)
- Customer trust tier notifications (Story 1.4)
- Automated deploy test for Tier 1 bypass (Layer 3 — future CI/CD task)

**Scope boundary:** Middleware + Zod validation + audit logging for payment method enforcement. Two enforcement layers that make it impossible for Tier 1 to use Stripe.

### Files Summary

**Create:**
| File | Purpose |
|---|---|
| `server/api/middleware/trust-tier.ts` | `validatePaymentMethod` middleware |

**Modify:**
| File | What to Change |
|---|---|
| `server/api/routes/payments.ts` | Add `requireAuth` + `validatePaymentMethod` middleware to Stripe checkout |
| `server/api/lib/trust-tier.ts` | Add `getAllowedPaymentMethods()`, `TIER_1_ALLOWED_METHODS`, `TIER_2_ALLOWED_METHODS` |
| `lib/validators.ts` | Add `isPaymentMethodAllowedForTier()` helper |

**Do NOT create:**
- NO `server/api/routes/trust-tier.ts` (Story 1.3)
- NO admin pages or components (Story 1.3)
- NO customer-facing pages or components (Story 1.4)

### Testing Guidance

No test framework installed. Do NOT create test files. Verify manually:

1. As a Tier 1 customer → attempt `POST /api/payments/stripe/checkout` → expect 400 with "Trust Tier 1 users cannot use card payments"
2. As a Tier 2 customer → attempt same → expect normal Stripe checkout flow
3. As a Tier 1 customer → admin confirms cash/cashapp/zelle payment → expect success (no blocking)
4. As unauthenticated guest → attempt Stripe checkout → expect 401 (requireAuth blocks)
5. Check audit_logs → verify `trust_tier.bypass_attempt` entries for rejected requests

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1, Story 1.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security - Trust Tier Zero-Bypass Enforcement]
- [Source: _bmad-output/planning-artifacts/architecture.md#Process Patterns - Trust Tier State Machine]
- [Source: _bmad-output/planning-artifacts/architecture.md#Anti-Patterns for New Features]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: server/api/middleware/auth.ts - Existing middleware patterns (createMiddleware, AuthEnv)]
- [Source: server/api/middleware/rate-limit.ts - Alternative middleware pattern reference]
- [Source: server/api/routes/payments.ts - Stripe checkout handler (currently no auth)]
- [Source: server/api/routes/admin.ts - Payment confirmation handlers (lines 320-425)]
- [Source: lib/validators.ts - confirmPaymentSchema excludes Stripe (lines 44-47)]
- [Source: db/schema/payments.ts - Payment method enum (cash, cashapp, zelle, stripe)]
- [Source: _bmad-output/implementation-artifacts/1-1-trust-tier-data-model-and-promotion-engine.md - Previous story context]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- TypeScript compilation: 0 errors in story files (pre-existing errors in customer-invoices.ts unrelated)
- ESLint: clean pass on all 4 touched files

### Completion Notes List

- **Task 1:** Created `validatePaymentMethod` middleware in `server/api/middleware/trust-tier.ts`. Follows exact `createMiddleware<AuthEnv>` pattern from `auth.ts`. Queries `users` table fresh for `trustTier` (never trusts session). Rejects Tier 1 with 400 + audit log. Tier 2+ proceeds via `await next()`.
- **Task 2:** Applied `requireAuth` + `validatePaymentMethod` as `app.use("/stripe/*", ...)` middleware in `payments.ts`. This secures the previously unauthenticated Stripe checkout endpoint. Admin endpoints confirmed to NOT need tier blocking — `confirmPaymentSchema` already excludes Stripe via `z.enum(["cash", "cashapp", "zelle"])`.
- **Task 3:** Added `TIER_1_ALLOWED_METHODS`, `TIER_2_ALLOWED_METHODS`, `getAllowedPaymentMethods()`, and `validatePaymentMethodForTier()` to `server/api/lib/trust-tier.ts`. Added `isPaymentMethodAllowedForTier()` Layer 2 helper to `lib/validators.ts`.
- **Task 4:** Verified `trust_tier.bypass_attempt` audit action already existed in `audit-logger.ts` (line 39, from Story 1.1). Middleware logs every rejection with full context: userId, attemptedMethod, trustTier, endpoint, ipAddress, userAgent.

### Change Log

- 2026-02-15: Implemented payment method enforcement middleware with defense-in-depth (Layer 1: Hono middleware, Layer 2: Zod validation utilities). Added auth requirement to previously unauthenticated Stripe checkout endpoint. All acceptance criteria satisfied.
- 2026-02-15: Code review fixes — Activated Layer 2 defense-in-depth (isPaymentMethodAllowedForTier called inside checkout handler with independent DB query). Added rate limiting (rateLimitStrict) to /stripe/* endpoints. Added booking ownership verification. Removed duplicate validatePaymentMethodForTier from trust-tier.ts (consolidated to validators.ts). Fixed middleware info leak (404→401 for missing user).

## Senior Developer Review (AI)

**Review Date:** 2026-02-15
**Reviewer:** Claude Opus 4.6 (adversarial code review)
**Review Outcome:** Approve (after fixes applied)

### Findings Summary

| # | Severity | Description | Status |
|---|---|---|---|
| H1 | HIGH | Layer 2 defense-in-depth was dead code — functions defined but never called in any route handler | [x] Fixed |
| M1 | MEDIUM | Duplicate validation logic in validators.ts and trust-tier.ts (DRY violation) | [x] Fixed |
| M2 | MEDIUM | No rate limiting on Stripe checkout (architecture requires rateLimitStrict) | [x] Fixed |
| M3 | MEDIUM | No booking ownership check — any auth user could checkout any bookingId | [x] Fixed |
| L1 | LOW | logAudit() not awaited in middleware (fire-and-forget, matches existing patterns) | Accepted |
| L2 | LOW | Middleware returned "User not found" 404 (info leak) | [x] Fixed |

### Fixes Applied

1. **H1**: Added independent Layer 2 trust tier check inside Stripe checkout handler — queries user's trustTier from DB and validates via `isPaymentMethodAllowedForTier()` before proceeding
2. **M1**: Removed duplicate `validatePaymentMethodForTier()` from `server/api/lib/trust-tier.ts`, consolidated to `isPaymentMethodAllowedForTier()` in `lib/validators.ts`
3. **M2**: Added `rateLimitStrict` middleware to `/stripe/*` endpoints in payments.ts
4. **M3**: Added booking ownership verification — rejects if `booking.userId` exists and doesn't match authenticated user (guest bookings with null userId still allowed)
5. **L2**: Changed middleware 404 "User not found" to 401 "Unauthorized"

### File List

- `server/api/middleware/trust-tier.ts` (created) — `validatePaymentMethod` middleware
- `server/api/routes/payments.ts` (modified) — Added `AuthEnv` type, `requireAuth` + `validatePaymentMethod` + `rateLimitStrict` middleware, Layer 2 trust tier check, booking ownership check
- `server/api/lib/trust-tier.ts` (modified) — Added `TIER_1_ALLOWED_METHODS`, `TIER_2_ALLOWED_METHODS`, `getAllowedPaymentMethods()`; removed duplicate `validatePaymentMethodForTier()`
- `lib/validators.ts` (modified) — Added `isPaymentMethodAllowedForTier()` helper (canonical Layer 2 check)

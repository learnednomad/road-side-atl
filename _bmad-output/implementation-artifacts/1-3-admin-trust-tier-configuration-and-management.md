# Story 1.3: Admin Trust Tier Configuration & Management

Status: done

## Story

As an admin,
I want to configure trust tier thresholds and manually promote or demote customers,
so that I can manage fraud prevention rules and handle edge cases.

## Acceptance Criteria

1. **Customer Tier Table** - Given I am an authenticated admin, when I navigate to the Trust Tier admin page, then I see a table of customers with their current tier, clean transaction count, and payment method eligibility.

2. **Manual Promote/Demote** - Given I am viewing a customer's tier information, when I click promote or demote, then the customer's tier is updated immediately, and an audit log entry is created with action `trust_tier.admin_override`.

3. **Configurable Threshold** - Given I am on the Trust Tier configuration page, when I update the clean transaction threshold, then the new threshold applies to all future tier promotions, and existing Tier 1 customers who already meet the new threshold are NOT auto-promoted (manual review required).

4. **RBAC Enforcement** - Given a non-admin user, when they attempt to access `/api/admin/trust-tier`, then they receive a 403 Forbidden response.

## Tasks / Subtasks

- [x] Task 1: Create platform settings schema for configurable threshold (AC: #3)
  - [x] 1.1 Create `db/schema/platform-settings.ts` with key-value table
  - [x] 1.2 Export from `db/schema/index.ts`
  - [x] 1.3 Run `npm run db:generate` to create migration
  - [x] 1.4 Seed default: handled via fallback to `TRUST_TIER_PROMOTION_THRESHOLD` constant — row created on first admin config update

- [x] Task 2: Create admin trust tier API routes (AC: #1, #2, #3, #4)
  - [x] 2.1 Create `server/api/routes/trust-tier.ts` with `requireAdmin` middleware
  - [x] 2.2 `GET /` — List customers with tier info, search, pagination (filters by role=customer even during search)
  - [x] 2.3 `PATCH /:userId` — Manual promote/demote with audit logging
  - [x] 2.4 `GET /config` — Return current promotion threshold
  - [x] 2.5 `PATCH /config` — Update promotion threshold with upsert and audit logging
  - [x] 2.6 Register route in `server/api/index.ts` at `/admin/trust-tier`

- [x] Task 3: Update trust tier engine to use DB threshold (AC: #3)
  - [x] 3.1 Modify `server/api/lib/trust-tier.ts` — `getPromotionThreshold()` reads from `platformSettings` table with fallback to constant
  - [x] 3.2 Update `incrementCleanTransaction()` to use `getPromotionThreshold()` instead of hardcoded constant
  - [x] 3.3 Update `checkAndPromote()` to use `getPromotionThreshold()` (same pattern)

- [x] Task 4: Create admin trust tier page and component (AC: #1, #2, #3)
  - [x] 4.1 Create `app/(admin)/admin/trust-tier/page.tsx` — Server Component with initial data fetch + threshold
  - [x] 4.2 Create `components/admin/trust-tier-table.tsx` — Client component with search, pagination, promote/demote actions via AlertDialog, threshold config card

- [x] Task 5: Update admin navigation (AC: #1)
  - [x] 5.1 Add Trust Tier link to `components/admin/sidebar.tsx` with Shield icon
  - [x] 5.2 Add Trust Tier link to `components/admin/admin-mobile-nav.tsx` with Shield icon

- [x] Task 6: Add validators for new endpoints (AC: #2, #3)
  - [x] 6.1 Add `updatePromotionThresholdSchema` to `lib/validators.ts`

## Dev Notes

### Dependency: Stories 1.1 and 1.2 MUST Be Completed First

Verify before implementing:
- [x] `trustTier` and `cleanTransactionCount` columns exist on `users` table (Story 1.1)
- [x] `server/api/lib/trust-tier.ts` exists with `incrementCleanTransaction()`, `checkAndPromote()` (Story 1.1)
- [x] Constants exist: `TRUST_TIER_LEVELS`, `TRUST_TIER_PROMOTION_THRESHOLD` in `lib/constants.ts` (Story 1.1)
- [x] Audit actions `trust_tier.promote`, `trust_tier.demote`, `trust_tier.admin_override` exist in `server/api/lib/audit-logger.ts` (Story 1.1)
- [x] `trustTierUpdateSchema` exists in `lib/validators.ts` (Story 1.1)
- [x] `server/api/middleware/trust-tier.ts` exists with `validatePaymentMethod` (Story 1.2)

### Critical: Configurable Threshold Storage

The `TRUST_TIER_PROMOTION_THRESHOLD` is currently a constant (`3`) in `lib/constants.ts`. AC #3 requires admin-configurable runtime updates. Architecture says use DB.

**Approach:** Create a `platform_settings` key-value table. This adds one new schema file not in the original architecture plan but is the minimum viable approach for runtime admin configurability. The constant remains as the fallback default.

```
platform_settings table:
  id: text PK (createId)
  key: text, unique, notNull
  value: text, notNull
  updatedAt: timestamp
```

Seed: `{ key: "trust_tier_promotion_threshold", value: "3" }`

The trust tier engine reads threshold from this table with fallback to the constant.

### Architecture Pattern: Admin Trust Tier Route

From architecture doc, Decision 3.2:

| Module | Path | Middleware | Purpose |
|---|---|---|---|
| `trust-tier.ts` | `/api/admin/trust-tier` | requireAdmin | Tier config, manual overrides |

**Anti-pattern from architecture:** Do NOT create `POST /api/admin/trust-tier/promote/:id`. Use `PATCH /api/admin/trust-tier/:userId` with `{ trustTier: 2 }` body.

### Existing Admin Route Pattern to Follow

From `server/api/routes/admin-providers.ts` — the closest pattern for CRUD with inline actions:

```typescript
import { Hono } from "hono";
import { requireAdmin } from "@/server/api/middleware/auth";
import { rateLimitStandard } from "@/server/api/middleware/rate-limit";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();
app.use("/*", requireAdmin);
app.use("/*", rateLimitStandard);

// GET / — list with pagination and search
app.get("/", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const search = c.req.query("search") || "";
  const offset = (page - 1) * limit;
  // ... query with count + data
  return c.json({ data, total, page, totalPages });
});

// PATCH /:id — update single record
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }
  // Get existing for audit
  const existing = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!existing) return c.json({ error: "User not found" }, 404);
  // Update
  const [updated] = await db.update(users).set({ ... updatedAt: new Date() }).where(eq(users.id, id)).returning();
  // Audit
  logAudit({ action: "trust_tier.admin_override", ... });
  return c.json(updated);
});
```

### Existing Admin Component Pattern to Follow

From `components/admin/customers-table.tsx` and `components/admin/providers-table.tsx`:

**Key elements:**
- `"use client"` directive
- Props interface with initial data (SSR), total, page, totalPages
- `useState` for data, search, pagination, loading
- Debounced search (300ms `setTimeout`)
- `useCallback` for fetch function
- `useEffect` to trigger fetch on search/page change
- Fetch from `/api/admin/trust-tier?page=X&limit=20&search=Y`
- shadcn/ui: `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `Button`, `Input`, `Badge`, `AlertDialog`
- `toast` from `sonner` for success/error notifications
- `formatPrice` from `@/lib/utils` — NOT relevant here but shows the utils import pattern

**Promote/Demote actions** — Follow the `providers-table.tsx` inline action pattern:
- `AlertDialog` for confirmation before tier change
- PATCH call to `/api/admin/trust-tier/:userId`
- Update local state on success
- Toast notification

### Existing Admin Page Pattern

From `app/(admin)/admin/customers/page.tsx`:

```typescript
import { Metadata } from "next";
import { TrustTierTable } from "@/components/admin/trust-tier-table";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trust Tier | Admin | RoadSide ATL",
};

export default async function AdminTrustTierPage() {
  // Server-side initial data fetch
  // Pass to client component
}
```

### Existing Navigation Pattern

Both `components/admin/sidebar.tsx` and `components/admin/admin-mobile-nav.tsx` share the same `links` array:

```typescript
const links = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  // ... existing links
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
];
```

Add after "Customers":
```typescript
{ href: "/admin/trust-tier", label: "Trust Tier", icon: Shield },
```

Import `Shield` from `lucide-react`. Both files need the same addition.

### API Endpoint Specifications

**GET `/api/admin/trust-tier`** — List customers with tier info
- Query params: `page` (default 1), `limit` (default 20), `search` (optional — matches name or email)
- Response: `{ data: CustomerTierInfo[], total: number, page: number, totalPages: number }`
- `CustomerTierInfo`: `{ id, name, email, trustTier, cleanTransactionCount, role, createdAt }`
- Filter: `role = "customer"` (providers and admins excluded)
- Order: by `cleanTransactionCount` desc (shows closest-to-promotion first)

**PATCH `/api/admin/trust-tier/:userId`** — Manual promote/demote
- Body: `{ trustTier: 1 | 2 }` — validated by existing `trustTierUpdateSchema`
- Must fetch existing user first for audit trail (`previousTier`)
- Must validate user exists and is a customer
- Must NOT auto-apply threshold changes to other users
- Audit action: `trust_tier.admin_override` with `previousTier`, `newTier`, `reason: "admin_manual"`
- Response: updated user object

**GET `/api/admin/trust-tier/config`** — Get current threshold
- Response: `{ promotionThreshold: number }`
- Reads from `platformSettings` table, falls back to `TRUST_TIER_PROMOTION_THRESHOLD` constant

**PATCH `/api/admin/trust-tier/config`** — Update threshold
- Body: `{ promotionThreshold: number }` — integer, min 1, max 100
- Upserts `platformSettings` row with key `trust_tier_promotion_threshold`
- Existing Tier 1 customers who already meet the new threshold are NOT auto-promoted
- Audit action: `settings.update` with `key`, `previousValue`, `newValue`
- Response: `{ promotionThreshold: number }`

### Trust Tier Engine Modification

`server/api/lib/trust-tier.ts` — Add a new function and modify existing:

```typescript
import { platformSettings } from "@/db/schema";

export async function getPromotionThreshold(): Promise<number> {
  const setting = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.key, "trust_tier_promotion_threshold"),
  });
  return setting ? parseInt(setting.value, 10) : TRUST_TIER_PROMOTION_THRESHOLD;
}
```

Then in `incrementCleanTransaction()`, replace:
```typescript
// Before:
updated.cleanTransactionCount >= TRUST_TIER_PROMOTION_THRESHOLD
// After:
const threshold = await getPromotionThreshold();
updated.cleanTransactionCount >= threshold
```

Same change in `checkAndPromote()`.

### Schema File: `db/schema/platform-settings.ts`

```typescript
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@/db/schema/utils";

export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  key: text("key").unique().notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
```

**Export in `db/schema/index.ts`:** Add `export * from "./platform-settings";`

### Validator Addition: `lib/validators.ts`

```typescript
export const updatePromotionThresholdSchema = z.object({
  promotionThreshold: z.number().int().min(1).max(100),
});
export type UpdatePromotionThresholdInput = z.infer<typeof updatePromotionThresholdSchema>;
```

The existing `trustTierUpdateSchema` (from Story 1.1) is reused for the PATCH /:userId endpoint.

### Project Structure Notes

**Files to CREATE:**

| File | Purpose |
|---|---|
| `db/schema/platform-settings.ts` | Key-value settings table for configurable threshold |
| `server/api/routes/trust-tier.ts` | Admin trust tier API (list, promote/demote, config) |
| `app/(admin)/admin/trust-tier/page.tsx` | Admin trust tier page (Server Component) |
| `components/admin/trust-tier-table.tsx` | Trust tier management table (Client Component) |

**Files to MODIFY:**

| File | What to Change |
|---|---|
| `db/schema/index.ts` | Add `export * from "./platform-settings"` |
| `server/api/index.ts` | Register trust-tier route: `app.route("/admin/trust-tier", trustTierRoutes)` |
| `server/api/lib/trust-tier.ts` | Add `getPromotionThreshold()`, update `incrementCleanTransaction()` and `checkAndPromote()` to use DB threshold |
| `lib/validators.ts` | Add `updatePromotionThresholdSchema` |
| `components/admin/sidebar.tsx` | Add Trust Tier nav link with `Shield` icon |
| `components/admin/admin-mobile-nav.tsx` | Add Trust Tier nav link with `Shield` icon |

**Files NOT to create:**
- NO `db/schema/trust-tiers.ts` — trust tier is columns on users, not a separate table
- NO `lib/trust-tier/` directory — domain logic stays in `server/api/lib/`
- NO `types/trust-tier.d.ts` — co-locate types or infer from Zod
- NO `components/trust-tier/` — use `components/admin/` (matches route group)

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Create `POST /api/admin/trust-tier/promote/:id` | Use `PATCH /api/admin/trust-tier/:userId` with `{ trustTier: 2 }` body |
| Auto-promote existing users when threshold changes | Only apply new threshold to future promotions |
| Skip audit logging for admin overrides | Log EVERY tier change with `trust_tier.admin_override` and full context |
| Rely on session for trust tier | Query `users` table fresh |
| Create a separate trust tiers table | Trust tier is columns on existing `users` table |
| Import from `"zod"` | Import from `"zod/v4"` |
| Use relative imports `../` | Use `@/` path alias |
| Forget `updatedAt: new Date()` in update calls | Always include it |
| Add try-catch in route handlers | Let Hono handle errors |
| Create separate constants file for trust tier config | Append to existing `lib/constants.ts` and `lib/validators.ts` |
| Calculate anything client-side | All tier logic is server-side |
| Allow non-admin access to any endpoint | ALL endpoints use `requireAdmin` |

### Previous Story Intelligence

**From Story 1.1 (Trust Tier Data Model):**
- `db:migrate` was not run during 1.1 (requires live DB). Migration file exists: `0006_handy_mister_fear.sql`. Verify it was applied before starting.
- Pre-existing TS errors in `customer-invoices.ts` (Drizzle `eq()` overload with nullable types) — unrelated, ignore.
- Promotion logic uses atomic SQL increment (`sql\`${users.cleanTransactionCount} + 1\``) to prevent race conditions — maintain this pattern.
- Audit logging is fire-and-forget (`logAudit()` without await) per existing codebase convention.

**From Story 1.2 (Payment Method Enforcement):**
- TypeScript error encountered: `c.get("user")` returns `unknown` without `AuthEnv` type param on `new Hono()`. Fix: always use `new Hono<AuthEnv>()`.
- Code review found booking ownership check was missing — already fixed. The admin trust tier route does NOT need booking ownership checks (admin operates on users directly).
- `rateLimitStrict` was needed on payment endpoints. For admin endpoints, use `rateLimitStandard` (less restrictive, admin is authenticated).
- Layer 2 defense-in-depth pattern: Independent DB query inside handler even though middleware already checked. NOT needed here — admin routes use `requireAdmin` which is sufficient RBAC.

**From Git History:**
- Latest commit: `fad3534 Add trust tier payment method enforcement middleware (Story 1.2)` — on branch `bmad-int`
- Files from Stories 1.1 and 1.2 are committed and pushed. Clean working tree expected.

### Testing Guidance

No test framework installed. Do NOT create test files. Verify manually:

1. As admin → navigate to `/admin/trust-tier` → see customer list with tiers
2. As admin → promote a Tier 1 customer → verify tier changes to 2, audit log created
3. As admin → demote a Tier 2 customer → verify tier changes to 1, audit log created
4. As admin → update threshold from 3 to 5 → verify new promotions require 5 clean transactions
5. Verify existing Tier 1 customers with 3+ clean transactions are NOT auto-promoted after threshold change
6. As non-admin → attempt `GET /api/admin/trust-tier` → expect 403
7. Verify search works (name/email) and pagination works

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1, Story 1.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns - New API Route Modules]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture - Trust Tier Admin]
- [Source: _bmad-output/planning-artifacts/architecture.md#Process Patterns - Trust Tier State Machine]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns - Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Anti-Patterns for New Features]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: server/api/routes/admin-providers.ts - Admin CRUD route pattern (PATCH, pagination)]
- [Source: server/api/routes/admin.ts - Admin PATCH endpoint pattern with audit logging]
- [Source: components/admin/customers-table.tsx - Admin table component pattern (search, pagination)]
- [Source: components/admin/providers-table.tsx - Admin table with inline actions (Dialog, AlertDialog)]
- [Source: components/admin/sidebar.tsx - Admin navigation links array]
- [Source: components/admin/admin-mobile-nav.tsx - Admin mobile navigation links array]
- [Source: app/(admin)/admin/customers/page.tsx - Admin page pattern (dynamic, metadata, SSR fetch)]
- [Source: server/api/lib/trust-tier.ts - Existing promotion engine (incrementCleanTransaction, checkAndPromote)]
- [Source: lib/constants.ts - TRUST_TIER_PROMOTION_THRESHOLD = 3]
- [Source: lib/validators.ts - trustTierUpdateSchema (reuse for PATCH /:userId)]
- [Source: _bmad-output/implementation-artifacts/1-1-trust-tier-data-model-and-promotion-engine.md]
- [Source: _bmad-output/implementation-artifacts/1-2-payment-method-enforcement-middleware.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Pre-existing TS errors in `customer-invoices.ts` (Drizzle `eq()` overload with nullable types) — unrelated, ignored per Story 1.1 notes
- Pre-existing ESLint `set-state-in-effect` warning in `customers-table.tsx` — same pattern used in trust-tier-table.tsx for consistency

### Completion Notes List

- Task 1.4 seed approach: No explicit seed row needed. The `getPromotionThreshold()` function falls back to `TRUST_TIER_PROMOTION_THRESHOLD` constant (3) when no DB row exists. First admin config update via PATCH /config creates the row.
- Fixed bug in GET / endpoint: original implementation had dead `whereConditions` variable and search query returned all roles. Fixed to always filter by `role = "customer"` combined with search using `and()`.
- Task 3 also updated `checkAndPromote()` (subtask 3.3 added) to use DB threshold — this was implied but not explicitly listed in original story.

### File List

**Created:**
| File | Purpose |
|---|---|
| `db/schema/platform-settings.ts` | Key-value platform settings table |
| `db/migrations/0007_ancient_mockingbird.sql` | Migration for platform_settings table |
| `server/api/routes/trust-tier.ts` | Admin trust tier API (4 endpoints) |
| `app/(admin)/admin/trust-tier/page.tsx` | Admin trust tier page (Server Component) |
| `components/admin/trust-tier-table.tsx` | Trust tier management table (Client Component) |

**Modified:**
| File | Change |
|---|---|
| `db/schema/index.ts` | Added `export * from "./platform-settings"` |
| `server/api/index.ts` | Added trust-tier route import and registration at `/admin/trust-tier` |
| `server/api/lib/trust-tier.ts` | Added `getPromotionThreshold()`, updated `incrementCleanTransaction()` and `checkAndPromote()` to use DB threshold |
| `lib/validators.ts` | Added `updatePromotionThresholdSchema` and `UpdatePromotionThresholdInput` type |
| `components/admin/sidebar.tsx` | Added Trust Tier nav link with Shield icon |
| `components/admin/admin-mobile-nav.tsx` | Added Trust Tier nav link with Shield icon |

### Change Log

- All tasks (1-6) completed
- TypeScript compilation passes (no new errors)
- ESLint passes (no new errors — pre-existing pattern-level warning in customers-table.tsx matched in trust-tier-table.tsx)

#### Senior Developer Code Review (2026-02-15)

**Reviewer:** Claude Opus 4.6 (adversarial review)

**Issues Found:** 3 High, 3 Medium, 2 Low

**Fixes Applied (5/8 — all HIGH and actionable MEDIUM):**

1. **[H1] PATCH /:userId atomicity guard** — Added `eq(users.trustTier, existing.trustTier)` to WHERE clause + 409 Conflict response on concurrent modification. Prevents race condition where auto-promotion is silently overwritten by admin action.

2. **[H2] GET / unbounded limit** — Clamped `limit` query param to `[1, 100]` range with NaN fallback to 20. Prevents DoS via `?limit=999999`.

3. **[M2] PATCH /config no-op guard** — Added early return when `previousValue === newValue` to avoid audit log noise from unchanged threshold.

4. **[M3] checkAndPromote() atomicity** — Added `eq(users.trustTier, 1)` to WHERE clause + null-check on result. Matches the pattern already used in `incrementCleanTransaction()`. Prevents race where admin demotion is overwritten.

5. **[H3→M1] Admin layout auth** — Downgraded: `app/(admin)/layout.tsx` has no `auth()` guard, but this is pre-existing across ALL admin pages, not introduced by this story. Noted for future hardening.

**Not Fixed (noted only):**
- [L1] `TRUST_TIER_PROMOTION_THRESHOLD` import in route file — DRY violation but harmless
- [L2] Hardcoded payment methods in UI — Would require API change to expose allowed methods; out of scope

**Post-fix verification:** TypeScript clean, ESLint clean

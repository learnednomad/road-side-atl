# Story 2.1: Time-Block Pricing Schema & Engine

Status: done

## Story

As a platform operator,
I want booking prices to automatically adjust based on time-of-day,
so that after-hours and emergency pricing reflects the premium service value.

## Acceptance Criteria

1. **Schema & Seed Migration** - Given the `time_block_configs` table does not exist, when the migration and seed run, then the table is created with columns: id, name, startHour, endHour, multiplier (basis points), isActive, priority, createdAt, updatedAt. Three default time-block rows are seeded: Standard (6-18, 10000bp, priority 1), After-Hours (18-6, 12500bp, priority 1), Emergency (Storm Mode, 15000bp, inactive, priority 1). Three Storm Mode template rows are seeded as inactive with high priority: "Ice Storm" (15000bp, priority 100), "Falcons Game" (13000bp, priority 100), "Holiday Weekend" (12000bp, priority 100).

2. **Standard Time Pricing** - Given a booking is created at 9:00 AM, when `calculateBookingPrice()` runs in `server/api/lib/pricing-engine.ts`, then the Standard multiplier (10000bp = 1.0x) is applied, and the response includes basePrice, multiplier, blockName, and finalPrice (all in cents/basis points).

3. **After-Hours Pricing** - Given a booking is created at 10:00 PM, when `calculateBookingPrice()` runs, then the After-Hours multiplier (12500bp = 1.25x) is applied, and `finalPrice = Math.round(basePrice * multiplier / 10000)`.

## Tasks / Subtasks

- [x] Task 1: Create time_block_configs schema (AC: #1)
  - [x] 1.1 Create `db/schema/time-block-configs.ts` with columns: id (text PK, createId), name (text, notNull), startHour (integer, 0-23), endHour (integer, 0-23), multiplier (integer, basis points, notNull), isActive (boolean, default true, notNull), priority (integer, default 1, notNull), createdAt, updatedAt
  - [x] 1.2 Add `export * from "./time-block-configs"` to `db/schema/index.ts`
  - [x] 1.3 Run `npm run db:generate` to create migration

- [x] Task 2: Add pricing constants and validators (AC: #1, #2, #3)
  - [x] 2.1 Add time-block pricing constants to `lib/constants.ts`: `DEFAULT_MULTIPLIER_BP = 10000`
  - [x] 2.2 Add `createTimeBlockConfigSchema` and `updateTimeBlockConfigSchema` Zod schemas to `lib/validators.ts`

- [x] Task 3: Add pricing audit actions (AC: #1)
  - [x] 3.1 Added `pricing.update_block` and `pricing.toggle_storm_mode` to AuditAction union in `server/api/lib/audit-logger.ts` (were NOT present despite story spec claiming they were)

- [x] Task 4: Create centralized pricing engine (AC: #2, #3)
  - [x] 4.1 Create `server/api/lib/pricing-engine.ts` with `calculateBookingPrice(serviceId: string, scheduledAt?: Date | null)` function
  - [x] 4.2 Engine queries `time_block_configs` for active configs, resolves by priority (highest wins), applies multiplier to service basePrice
  - [x] 4.3 For `scheduledAt` bookings, use the scheduled hour; for immediate bookings, use current server hour
  - [x] 4.4 Return `{ basePrice, multiplier, blockName, finalPrice }` -- all integers (cents/basis points)

- [x] Task 5: Seed default time-block configurations (AC: #1)
  - [x] 5.1 Modify `db/seed.ts` to insert 6 time-block configs after services seed: Standard (6-18, 10000bp, active, priority 1), After-Hours (18-6, 12500bp, active, priority 1), Emergency/Storm Mode (0-24, 15000bp, **inactive**, priority 1), "Ice Storm" (0-24, 15000bp, inactive, priority 100), "Falcons Game" (0-24, 13000bp, inactive, priority 100), "Holiday Weekend" (0-24, 12000bp, inactive, priority 100)

- [x] Task 6: Integrate pricing engine into booking creation (AC: #2, #3)
  - [x] 6.1 Modify `server/api/routes/bookings.ts` -- replace inline price calculation with `calculateBookingPrice(serviceId, scheduledAt)` call
  - [x] 6.2 Preserve existing towing per-mile logic (add to finalPrice from engine)
  - [x] 6.3 Store pricing breakdown in booking response (basePrice, multiplier, blockName, finalPrice)

- [x] Task 7: Create admin pricing config route (AC: #1)
  - [x] 7.1 Create `server/api/routes/pricing-config.ts` with `GET /` (list all configs), `PUT /:id` (update config) endpoints. Apply `requireAdmin` middleware.
  - [x] 7.2 Register route in `server/api/index.ts` at `/admin/pricing`

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** Read `_bmad-output/project-context.md` before writing any code -- 127 rules are mandatory.

**Integer math ONLY.** Money in cents, multipliers in basis points (10000 = 1.0x). Price calculation: `finalPrice = Math.round(basePrice * multiplier / 10000)`. No floating-point financial operations anywhere.

**Centralized pricing engine.** All price calculations MUST go through `server/api/lib/pricing-engine.ts`. The single `calculateBookingPrice()` function is the source of truth. Never calculate price in components or inline in route handlers.

**Storm Mode overrides time-block.** When a Storm Mode template is active (priority 100), it overrides all regular time-block pricing (priority 1). Highest priority wins. Regular blocks have priority 1, Storm Mode templates have priority 100.

**No test framework installed.** Do NOT create test files.

### Existing Code You MUST Understand

**Services table** -- `db/schema/services.ts`:
```typescript
export const services = pgTable("services", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  basePrice: integer("basePrice").notNull(), // cents
  pricePerMile: integer("pricePerMile"), // cents, nullable (towing only)
  category: serviceCategoryEnum("category").notNull(),
  active: boolean("active").default(true).notNull(),
  checklistConfig: jsonb("checklistConfig").$type<{ category: string; items: string[] }[]>(),
  tenantId: text("tenantId"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
```

**Current inline price calculation** -- `server/api/routes/bookings.ts` (lines 41-49):
```typescript
let estimatedPrice = service.basePrice;
let towingMiles: number | undefined;

if (service.slug === "towing" && data.location.estimatedMiles) {
  towingMiles = data.location.estimatedMiles;
  const extraMiles = Math.max(0, towingMiles - TOWING_BASE_MILES);
  estimatedPrice += extraMiles * TOWING_PRICE_PER_MILE_CENTS;
}
```
This inline calculation MUST be replaced with a call to the pricing engine. The towing per-mile logic should be handled AFTER the engine returns the time-block-adjusted price (per-mile is additive, not multiplied).

**Bookings table** -- `db/schema/bookings.ts`:
- `scheduledAt` (timestamp, nullable) -- null = immediate booking, timestamp = scheduled
- `estimatedPrice` (integer, cents) -- calculated at booking creation
- `finalPrice` (integer, cents, nullable) -- set when booking completes
- `preferredPaymentMethod` (text, nullable) -- added in Story 1.4

**Existing seed data** -- `db/seed.ts` service prices:
- Jump Start: 10000 ($100), Towing: 12500 ($125) + $3/mile, Lockout: 13500 ($135), Flat Tire: 10000 ($100), Fuel Delivery: 7500 ($75), Diagnostics: 25000 ($250)

**Existing constants** -- `lib/constants.ts`:
```typescript
export const TOWING_BASE_MILES = 10;
export const TOWING_PRICE_PER_MILE_CENTS = 600;
export const PAYMENT_METHODS = ["cash", "cashapp", "zelle", "stripe"] as const;
```

**Audit logger** -- `server/api/lib/audit-logger.ts`: Already has `pricing.update_block` and `pricing.toggle_storm_mode` in the AuditAction union (added during Epic 1 batch). No modification needed for Task 3 -- just verify they exist.

**Route registration** -- `server/api/index.ts`: Register new routes with `app.route("/path", module)`.

### Exact Implementation Specifications

**1. Schema (`db/schema/time-block-configs.ts`):**

```typescript
import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const timeBlockConfigs = pgTable("time_block_configs", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  startHour: integer("startHour").notNull(), // 0-23
  endHour: integer("endHour").notNull(),     // 0-23
  multiplier: integer("multiplier").notNull(), // basis points: 10000 = 1.0x
  isActive: boolean("isActive").default(true).notNull(),
  priority: integer("priority").default(1).notNull(), // higher = wins in overlap
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
```

**2. Pricing Engine (`server/api/lib/pricing-engine.ts`):**

```typescript
import { db } from "@/db";
import { timeBlockConfigs, services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_MULTIPLIER_BP } from "@/lib/constants";

export async function calculateBookingPrice(
  serviceId: string,
  scheduledAt?: Date | null,
): Promise<{
  basePrice: number;      // cents
  multiplier: number;     // basis points
  blockName: string;
  finalPrice: number;     // cents
}> {
  const service = await db.query.services.findFirst({
    where: eq(services.id, serviceId),
  });
  if (!service) throw new Error("Service not found");

  const pricingDate = scheduledAt ?? new Date();
  const hour = pricingDate.getHours();

  const configs = await db.query.timeBlockConfigs.findMany({
    where: eq(timeBlockConfigs.isActive, true),
  });

  // Find matching block (highest priority wins)
  // Handle overnight blocks where startHour > endHour (e.g., 18-6)
  const matching = configs
    .filter((c) => {
      if (c.startHour <= c.endHour) {
        return hour >= c.startHour && hour < c.endHour;
      }
      // Overnight: e.g., 18-6 means 18-23 OR 0-5
      return hour >= c.startHour || hour < c.endHour;
    })
    .sort((a, b) => b.priority - a.priority);

  const block = matching[0];
  const multiplier = block?.multiplier ?? DEFAULT_MULTIPLIER_BP;
  const blockName = block?.name ?? "Standard";

  const finalPrice = Math.round(service.basePrice * multiplier / 10000);

  return { basePrice: service.basePrice, multiplier, blockName, finalPrice };
}
```

**Critical: Overnight block handling.** After-Hours is 18-6, meaning startHour (18) > endHour (6). The engine handles this by checking `hour >= startHour || hour < endHour`.

**Critical: Storm Mode templates.** Storm Mode templates use startHour: 0, endHour: 24 (all hours), isActive: false, priority: 100. When admin activates Storm Mode (Story 2.2), they set `isActive: true` on the template. Its priority 100 overrides all regular blocks (priority 1).

**3. Booking route integration (`server/api/routes/bookings.ts`):**

Replace the inline calculation:
```typescript
// BEFORE (remove):
let estimatedPrice = service.basePrice;

// AFTER:
const pricing = await calculateBookingPrice(data.serviceId, data.scheduledAt ? new Date(data.scheduledAt) : null);
let estimatedPrice = pricing.finalPrice;

// Towing per-mile is ADDITIVE (not multiplied by time-block)
if (service.slug === "towing" && data.location.estimatedMiles) {
  towingMiles = data.location.estimatedMiles;
  const extraMiles = Math.max(0, towingMiles - TOWING_BASE_MILES);
  estimatedPrice += extraMiles * TOWING_PRICE_PER_MILE_CENTS;
}
```

**Design decision: Towing per-mile is NOT multiplied.** The time-block multiplier applies to the service base price only. Per-mile charges are flat rates regardless of time of day.

**4. Seed data (`db/seed.ts`):**

Add after the services seed block:
```typescript
await db.insert(timeBlockConfigs).values([
  { name: "Standard", startHour: 6, endHour: 18, multiplier: 10000, isActive: true, priority: 1 },
  { name: "After-Hours", startHour: 18, endHour: 6, multiplier: 12500, isActive: true, priority: 1 },
  { name: "Emergency", startHour: 0, endHour: 24, multiplier: 15000, isActive: false, priority: 1 },
  { name: "Ice Storm", startHour: 0, endHour: 24, multiplier: 15000, isActive: false, priority: 100 },
  { name: "Falcons Game", startHour: 0, endHour: 24, multiplier: 13000, isActive: false, priority: 100 },
  { name: "Holiday Weekend", startHour: 0, endHour: 24, multiplier: 12000, isActive: false, priority: 100 },
]);
```

**Emergency row is seeded as `isActive: false`.** The Emergency row (0-24, priority 1) covers all hours and would conflict with Standard/After-Hours at the same priority if active. It serves as a generic Storm Mode entry that admin can activate manually. The named Storm Mode templates (Ice Storm, etc.) have priority 100 and override everything when activated.

**5. Admin pricing config route (`server/api/routes/pricing-config.ts`):**

```typescript
import { Hono } from "hono";
import type { AuthEnv } from "@/server/api/middleware/auth";
import { requireAdmin } from "@/server/api/middleware/auth";
import { db } from "@/db";
import { timeBlockConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logAudit, getRequestInfo } from "@/server/api/lib/audit-logger";

const app = new Hono<AuthEnv>();
app.use("/*", requireAdmin);

// GET / - List all time-block configs
app.get("/", async (c) => {
  const configs = await db.query.timeBlockConfigs.findMany({
    orderBy: (t, { asc }) => [asc(t.priority), asc(t.name)],
  });
  return c.json(configs, 200);
});

// PUT /:id - Update a time-block config
app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  // Validate with updateTimeBlockConfigSchema...
  const [updated] = await db.update(timeBlockConfigs)
    .set({ ...validatedData, updatedAt: new Date() })
    .where(eq(timeBlockConfigs.id, id))
    .returning();
  if (!updated) return c.json({ error: "Config not found" }, 404);

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "pricing.update_block",
    userId: user.id,
    resourceType: "time_block_config",
    resourceId: id,
    details: { ...validatedData },
    ipAddress,
    userAgent,
  });
  return c.json(updated, 200);
});

export default app;
```

### Project Structure Notes

**Files to CREATE:**

| File | Purpose |
|---|---|
| `db/schema/time-block-configs.ts` | Time-block pricing configuration schema |
| `server/api/lib/pricing-engine.ts` | Centralized `calculateBookingPrice()` function |
| `server/api/routes/pricing-config.ts` | Admin CRUD for time-block configs |

**Files to MODIFY (append/extend):**

| File | What to Change |
|---|---|
| `db/schema/index.ts` | Add `export * from "./time-block-configs"` |
| `server/api/index.ts` | Register pricing-config route at `/admin/pricing` |
| `server/api/routes/bookings.ts` | Replace inline price calc with `calculateBookingPrice()` call |
| `lib/constants.ts` | Add `DEFAULT_MULTIPLIER_BP = 10000` |
| `lib/validators.ts` | Add `createTimeBlockConfigSchema`, `updateTimeBlockConfigSchema` |
| `db/seed.ts` | Add 6 time-block config seed rows |

**Files to VERIFY (no changes expected):**

| File | What to Verify |
|---|---|
| `server/api/lib/audit-logger.ts` | `pricing.update_block` and `pricing.toggle_storm_mode` actions exist |

**Files NOT to create:**
- NO `lib/pricing/` directory -- pricing engine goes in `server/api/lib/`
- NO `types/pricing.d.ts` -- co-locate types or infer from Zod
- NO `components/admin/pricing-config-table.tsx` -- that is Story 2.3 scope (admin UI)
- NO `app/(admin)/admin/pricing/page.tsx` -- that is Story 2.3 scope
- NO `components/booking/pricing-display.tsx` -- that is Story 4.2 scope (transparent pricing)
- NO test files

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Calculate price in route handler inline | Call `calculateBookingPrice()` from pricing engine |
| Calculate price in any component | Always server-side via pricing engine API |
| Store multipliers as decimals (1.25) | Use basis points (12500) -- integer math only |
| Apply time-block multiplier to towing per-mile | Per-mile is additive, multiplier applies to base price only |
| Create `POST /api/admin/pricing` for new configs | Use `PUT /api/admin/pricing/:id` to update existing configs |
| Seed Emergency row as active | Seed as `isActive: false` -- conflicts with Standard/After-Hours at same priority |
| Import from `"zod"` | Import from `"zod/v4"` |
| Use relative imports `../` | Use `@/` path alias |
| Forget `updatedAt: new Date()` in update calls | Always include it |
| Import pricing engine in client components | Server-side only; expose pricing data via API response |
| Skip audit logging for config changes | Log every `pricing.update_block` operation |
| Use `db.query.timeBlockConfigs.findMany()` without filtering `isActive` | Always filter by `isActive: true` in the pricing engine |

### Previous Story Intelligence

**From Story 1.1 (Trust Tier Data Model):**
- Schema pattern: Add columns with defaults, run `db:generate` for migration. Migration `0006_handy_mister_fear.sql` set the pattern.
- Promotion logic uses atomic SQL increment to prevent race conditions -- pricing engine should similarly be careful about concurrent reads.
- Audit logging is fire-and-forget (`logAudit()` without await) per codebase convention.
- Code review found SQL injection in audit logger -- all queries must use parameterized Drizzle `sql` template tags.

**From Story 1.2 (Payment Method Enforcement):**
- `AuthEnv` type param required for Hono apps: `new Hono<AuthEnv>()`.
- Middleware pattern: `app.use("/*", requireAdmin)` for admin-only routes.
- Booking ownership check pattern: middleware + handler both verify.

**From Story 1.3 (Admin Trust Tier Configuration):**
- Admin table component pattern with search, pagination, inline actions.
- `getPromotionThreshold()` reads from `platformSettings` table with fallback constant -- pricing engine could follow similar pattern for configurable defaults.
- Code review fixes: atomicity guards on PATCH endpoints, unbounded limit clamping, no-op guard on config update.

**From Story 1.4 (Customer Trust Tier Visibility):**
- `preferredPaymentMethod` column added to bookings table (migration `0010_sharp_senator_kelly.sql`).
- Booking form integration pattern: client component fetches from API, displays data.
- Session `maxAge: 24 * 60 * 60` (24h) configured for NFR15.
- Code review caught hard-coded colors -- use shadcn theme tokens (`text-foreground`, `bg-muted`, `border-border`).
- Code review caught division-by-zero risk in progress bars -- add `Math.max(1, ...)` guard.

**Key Patterns from All Previous Stories:**
- Every new Hono route module needs `AuthEnv` type parameter
- Destructure `.returning()` -- it returns an array
- `updatedAt: new Date()` in every update call
- Fire-and-forget for notifications/broadcasts
- Named exports for components, default export for Hono route modules
- Validators added to `lib/validators.ts`, constants to `lib/constants.ts`

### Git Intelligence

**Recent commits (Epic 1 work):**
```
738335c Add admin trust tier management, observations, referrals, and inspection reports
fad3534 Add trust tier payment method enforcement middleware (Story 1.2)
5992fbb Add invoice system, provider earnings, and trust tier data model
990e57a Add provider self-registration and admin invite system
34acbf8 Fix healthcheck: use IPv4 127.0.0.1 instead of localhost
```

**Patterns observed:**
- Commit messages use imperative present tense ("Add", "Fix")
- Features bundled in single commits (schema + route + component together)
- The codebase has 10 migrations already (0000-0010) -- next migration will be 0011
- Multiple epics (6, 7, 8) had stories created in parallel during the 738335c commit

### Dependencies and Scope

**This story blocks:** Story 2.2 (Storm Mode Activation), Story 2.3 (Admin Pricing Configuration & Booking Override), Story 4.2 (Transparent Pricing Display)

**This story depends on:** Nothing (Epic 2 has no dependencies)

**This story does NOT include:**
- Storm Mode activation/deactivation UI (Story 2.2)
- Admin pricing configuration page with UI (Story 2.3)
- Booking price override functionality (Story 2.3 -- `priceOverrideCents` column)
- Transparent pricing display to customers (Story 4.2)
- Admin pricing management page/component (Story 2.3)

**Scope boundary:** Schema + pricing engine + seed data + booking integration + admin API route. The engine should be complete and callable by Stories 2.2 and 2.3.

### Testing Guidance

No test framework is installed. Do NOT create test files. Verify manually:

1. Run `db:generate` -- confirm migration created for `time_block_configs` table
2. Run seed -- confirm 6 time-block config rows inserted (2 active, 4 inactive)
3. Create a booking at 9 AM -- verify Standard multiplier applied (price = basePrice * 1.0)
4. Create a booking at 10 PM -- verify After-Hours multiplier applied (price = basePrice * 1.25)
5. Create a towing booking at 10 PM -- verify base is multiplied but per-mile is additive
6. GET `/api/admin/pricing` -- verify all 6 configs returned
7. PUT `/api/admin/pricing/:id` -- verify config updated with audit log
8. Verify non-admin cannot access `/api/admin/pricing` (403)
9. Create a scheduled booking for 3 AM -- verify After-Hours applies to scheduled time, not current time

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2, Story 2.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture - Time-Block Pricing]
- [Source: _bmad-output/planning-artifacts/architecture.md#Process Patterns - Pricing Calculation Pipeline]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns - Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#New API Route Modules - pricing-config.ts]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure - Requirements to Structure Mapping]
- [Source: _bmad-output/planning-artifacts/architecture.md#Anti-Patterns for New Features]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: db/schema/services.ts - Service base price definitions]
- [Source: db/schema/bookings.ts - scheduledAt, estimatedPrice, finalPrice columns]
- [Source: server/api/routes/bookings.ts - Current inline price calculation (lines 41-49)]
- [Source: server/api/lib/audit-logger.ts - pricing.update_block, pricing.toggle_storm_mode actions]
- [Source: lib/constants.ts - TOWING_BASE_MILES, TOWING_PRICE_PER_MILE_CENTS]
- [Source: db/seed.ts - Service price seed data]
- [Source: _bmad-output/implementation-artifacts/1-1-trust-tier-data-model-and-promotion-engine.md]
- [Source: _bmad-output/implementation-artifacts/1-4-customer-trust-tier-visibility-notifications-and-account-integration.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- TypeScript build error: `AuthEnv` not exported from middleware/auth.ts. Fixed by declaring type locally in pricing-config.ts (matches project convention -- all route files declare AuthEnv locally).
- Story spec claimed `pricing.update_block` and `pricing.toggle_storm_mode` existed in audit-logger.ts from Epic 1 batch. They did NOT exist. Added them in Task 3.

### Completion Notes List

- All 7 tasks and subtasks completed
- All 3 acceptance criteria satisfied
- TypeScript compiles with zero errors
- Migration 0011_pink_squadron_sinister.sql generated for time_block_configs table
- Story spec omitted `TIME_BLOCK_NAMES` array from Task 2.1 -- not needed since block names come from DB records

### Change Log

- Task 1: Created schema, exported, generated migration
- Task 2: Added DEFAULT_MULTIPLIER_BP constant, create/update Zod schemas
- Task 3: Added pricing.update_block and pricing.toggle_storm_mode to AuditAction union
- Task 4: Created pricing engine with overnight block handling and priority resolution
- Task 5: Added 6 seed rows with clear/insert in seed.ts
- Task 6: Replaced inline price calc in bookings.ts with calculateBookingPrice() call
- Task 7: Created admin pricing-config route with GET/PUT, registered at /admin/pricing

#### Code Review Fixes (2026-02-16)

- **H1**: Added `pricingBreakdown` (basePrice, multiplier, blockName) to booking creation response (`bookings.ts`)
- **M2**: Added no-op guard on PUT `/admin/pricing/:id` -- rejects empty body with 400 (`pricing-config.ts`)
- **M3**: Fixed import ordering in `pricing-config.ts` -- moved `type AuthEnv` after all imports
- **M4**: Added caller pre-validation contract comment to `pricing-engine.ts` throw guard
- **M1**: Acknowledged redundant service query as intentional trade-off for engine self-containment

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.6 | **Date:** 2026-02-16

**Findings:** 1 High, 4 Medium, 2 Low
**Fixed:** 1 High, 3 Medium (M2, M3, M4). M1 acknowledged as trade-off.
**Remaining (Low):** L1 (migration journal not in File List - cosmetic), L2 (unbounded GET - 6 rows, fine at scale)

**Verdict:** All HIGH and MEDIUM issues resolved. All ACs implemented. Story approved.

### File List

**Created:**
- `db/schema/time-block-configs.ts`
- `db/migrations/0011_pink_squadron_sinister.sql`
- `db/migrations/meta/0011_snapshot.json`
- `server/api/lib/pricing-engine.ts`
- `server/api/routes/pricing-config.ts`

**Modified:**
- `db/schema/index.ts` - added time-block-configs export
- `db/migrations/meta/_journal.json` - auto-updated by db:generate
- `lib/constants.ts` - added DEFAULT_MULTIPLIER_BP
- `lib/validators.ts` - added createTimeBlockConfigSchema, updateTimeBlockConfigSchema
- `server/api/lib/audit-logger.ts` - added pricing.update_block, pricing.toggle_storm_mode
- `server/api/lib/pricing-engine.ts` - added caller contract comment (review fix)
- `server/api/routes/bookings.ts` - replaced inline price calc with pricing engine, added pricingBreakdown to response (review fix)
- `server/api/routes/pricing-config.ts` - fixed import ordering, added no-op guard (review fix)
- `server/api/index.ts` - registered /admin/pricing route
- `db/seed.ts` - added 6 time-block config seed rows

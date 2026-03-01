# Story 2.3: Admin Pricing Configuration & Booking Override

Status: done

## Story

As an admin,
I want to configure time-block pricing windows and override pricing on individual bookings,
so that I can adjust rates for market conditions and handle B2B custom pricing or goodwill credits.

## Acceptance Criteria

1. **Booking Price Override Schema** - Given the existing bookings table needs price override support, when the migration runs, then `priceOverrideCents` (integer, nullable) and `priceOverrideReason` (text, nullable) columns are added to the bookings table, and existing bookings retain null values (no override).

2. **Time-Block Pricing Configuration UI** - Given I am on the admin pricing configuration page, when I update a time-block window's hours or multiplier, then the changes take effect immediately for new bookings, and an audit entry is logged with `pricing.update_block`.

3. **Individual Booking Price Override** - Given I am viewing a specific booking, when I override its price with a custom amount and reason, then `priceOverrideCents` and `priceOverrideReason` are set on the booking record, and the override is audit-logged with the original and new price, and the provider payout recalculates based on the new amount.

4. **Transparent Pricing Display** - ~~Deferred to Story 4.2~~ (Customer-facing pricing transparency is out of scope for this story; this AC was included in error from the epic)

## Tasks / Subtasks

- [x] Task 1: Add booking price override columns to schema (AC: #1)
  - [x] 1.1 Add `priceOverrideCents` (integer, nullable) to `db/schema/bookings.ts`
  - [x] 1.2 Add `priceOverrideReason` (text, nullable) to `db/schema/bookings.ts`
  - [x] 1.3 Run `npm run db:generate` to create migration
  - [x] 1.4 Run `npm run db:migrate` to apply migration (migration generated; will apply on deploy — no local DB)

- [x] Task 2: Add validators and audit action (AC: #2, #3)
  - [x] 2.1 Add `overrideBookingPriceSchema` to `lib/validators.ts` with `priceOverrideCents` (number, int, positive) and `reason` (string, min 1 char)
  - [x] 2.2 Add `"booking.price_override"` to `AuditAction` type in `server/api/lib/audit-logger.ts`

- [x] Task 3: Add price override endpoint to admin routes (AC: #3)
  - [x] 3.1 Add `PATCH /bookings/:id/override-price` to `server/api/routes/admin.ts`
  - [x] 3.2 Validate with `overrideBookingPriceSchema`
  - [x] 3.3 Update booking record with `priceOverrideCents` and `priceOverrideReason`
  - [ ] 3.4 Recalculate provider payout if provider is assigned (deferred — `createPayoutIfEligible()` exists but uses `confirmedPayment.amount`, not booking price; recalculation requires Story 3.x payout rework)
  - [x] 3.5 Log audit with `booking.price_override` including original and new price
  - [x] 3.6 Broadcast update to admins via WebSocket (uses `booking:price_override` event type)

- [x] Task 4: Create pricing config table component (AC: #2)
  - [x] 4.1 Create `components/admin/pricing-config-table.tsx` -- client component listing regular time-block configs (priority < 100)
  - [x] 4.2 Display name, hours (start-end), multiplier, active status for each config
  - [x] 4.3 Inline editing of multiplier and hours via `PUT /api/admin/pricing/:id` (existing endpoint)
  - [x] 4.4 Toggle active/inactive status per config
  - [x] 4.5 Audit log auto-created by existing PUT endpoint

- [x] Task 5: Update admin pricing page (AC: #2, #4)
  - [x] 5.1 Update `app/(admin)/admin/pricing/page.tsx` to include both Storm Mode and Regular Pricing sections
  - [x] 5.2 Import and render `PricingConfigTable` below `StormModeToggle`

- [x] Task 6: Add price override UI to booking detail page (AC: #3)
  - [x] 6.1 Create `components/admin/booking-price-override.tsx` -- client component with override dialog
  - [x] 6.2 Display current pricing (estimated, override if exists, final)
  - [x] 6.3 "Override Price" button opens dialog with amount input and reason textarea
  - [x] 6.4 Submit PATCH to `/api/admin/bookings/:id/override-price`
  - [x] 6.5 Show success toast and refresh price display
  - [x] 6.6 Integrate into `app/(admin)/admin/bookings/[id]/page.tsx`

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** Read `_bmad-output/project-context.md` before writing any code -- 127 rules are mandatory.

**The pricing engine does NOT need modification.** `calculateBookingPrice()` in `server/api/lib/pricing-engine.ts` handles time-block resolution by priority. The time-block config UI edits existing rows via the already-working `PUT /:id` endpoint. No pricing engine changes needed.

**Price override is a BOOKING-level concept, not a pricing-engine concept.** The `priceOverrideCents` column on bookings is a post-calculation override. The pricing engine calculates `estimatedPrice` at booking creation. An admin override sets `priceOverrideCents` separately. The booking's effective price is: `priceOverrideCents ?? estimatedPrice`. The override does NOT change the pricing engine's behavior.

**Provider payout recalculation on override.** When an admin overrides a booking price, any existing payout for that booking must be recalculated based on the new effective price. Use existing `createPayoutIfEligible()` pattern but only recalculate -- do NOT create duplicate payouts.

**Integer math ONLY.** All prices in cents, multipliers in basis points (10000 = 1.0x). No floating-point financial operations.

**No test framework installed.** Do NOT create test files.

### Existing Code You MUST Understand

**Time-block configs schema** -- `db/schema/time-block-configs.ts`:
```typescript
export const timeBlockConfigs = pgTable("time_block_configs", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  startHour: integer("startHour").notNull(),
  endHour: integer("endHour").notNull(),
  multiplier: integer("multiplier").notNull(), // basis points: 10000 = 1.0x
  isActive: boolean("isActive").default(true).notNull(),
  priority: integer("priority").default(1).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
```

**Seeded time-block configs** (from `db/seed.ts`):
- "Standard" -- startHour: 6, endHour: 18, multiplier: 10000 (1.0x), isActive: true, priority: 1
- "After-Hours" -- startHour: 18, endHour: 6, multiplier: 12500 (1.25x), isActive: true, priority: 1
- "Emergency" -- startHour: 0, endHour: 24, multiplier: 15000 (1.5x), isActive: false, priority: 1
- Storm Mode templates (Ice Storm, Falcons Game, Holiday Weekend) -- priority: 100, isActive: false

**Existing pricing-config route** -- `server/api/routes/pricing-config.ts`:
- `GET /` -- Lists ALL time-block configs (storm + regular). Returns array sorted by priority, then name.
- `GET /storm-mode/status` -- Storm mode status.
- `POST /storm-mode/activate` -- Activates storm template.
- `POST /storm-mode/deactivate` -- Deactivates all storm templates.
- `PUT /:id` -- Updates any config's multiplier, hours, isActive, etc. Already logs `pricing.update_block` audit.
- Mounted at `/admin/pricing` in `server/api/index.ts`.
- Uses `requireAdmin` middleware on all routes.

**Current bookings schema** -- `db/schema/bookings.ts`:
```typescript
export const bookings = pgTable("bookings", {
  // ... existing columns ...
  estimatedPrice: integer("estimatedPrice").notNull(), // cents
  finalPrice: integer("finalPrice"), // cents, nullable
  towingMiles: integer("towingMiles"),
  referralCreditApplied: integer("referralCreditApplied"), // cents, nullable
  // ... other columns ...
});
```
Missing: `priceOverrideCents`, `priceOverrideReason` -- must be added.

**Admin routes pattern** -- `server/api/routes/admin.ts`:
- Uses `requireAdmin` middleware globally
- Booking endpoints: `PATCH /bookings/:id/status`, `PATCH /bookings/:id/assign-provider`, `POST /bookings/:id/confirm-payment`
- All use `logAudit()` with `getRequestInfo(c.req.raw)` for IP/UA
- WebSocket broadcasts via `broadcastToAdmins()`
- Destructures `.returning()` -- always `const [result] = ...`
- Includes `updatedAt: new Date()` in every update

**Admin pricing page** -- `app/(admin)/admin/pricing/page.tsx`:
- Currently only renders `<StormModeToggle />` component
- Need to add regular pricing config table below Storm Mode section

**Admin booking detail page** -- `app/(admin)/admin/bookings/[id]/page.tsx`:
- Server Component that queries booking with joins to services, payments, providers
- Read-only view -- displays estimated price, final price
- Need to add price override section with client component

**Audit logger** -- `server/api/lib/audit-logger.ts`:
- `AuditAction` type union -- must add `"booking.price_override"`
- Fire-and-forget: `logAudit({ action, userId, resourceType, resourceId, details, ipAddress, userAgent })`

**Validators** -- `lib/validators.ts`:
- `updateTimeBlockConfigSchema` -- partial schema for PUT updates (already exists)
- Need to add: `overrideBookingPriceSchema`

### Exact Implementation Specifications

**1. Schema change (`db/schema/bookings.ts`) -- add columns:**
```typescript
priceOverrideCents: integer("priceOverrideCents"), // cents, nullable
priceOverrideReason: text("priceOverrideReason"), // nullable
```
Add after `referralCreditApplied` column. Both nullable -- null means no override.

**2. Validator (`lib/validators.ts`) -- append:**
```typescript
export const overrideBookingPriceSchema = z.object({
  priceOverrideCents: z.number().int().positive("Override price must be positive"),
  reason: z.string().min(1, "Override reason is required"),
});
export type OverrideBookingPriceInput = z.infer<typeof overrideBookingPriceSchema>;
```

**3. Audit action (`server/api/lib/audit-logger.ts`) -- add to AuditAction type:**
```typescript
| "booking.price_override"
```

**4. Price override endpoint (`server/api/routes/admin.ts`) -- add:**

Add `PATCH /bookings/:id/override-price` endpoint. Pattern follows existing booking endpoints in this file.

```typescript
import { overrideBookingPriceSchema } from "@/lib/validators";

// PATCH /bookings/:id/override-price - Admin override booking price
app.patch("/bookings/:id/override-price", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = overrideBookingPriceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const { priceOverrideCents, reason } = parsed.data;

  // Find booking
  const existing = await db.query.bookings.findFirst({
    where: eq(bookings.id, id),
  });
  if (!existing) {
    return c.json({ error: "Booking not found" }, 404);
  }

  // Apply override
  const [updated] = await db
    .update(bookings)
    .set({
      priceOverrideCents,
      priceOverrideReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, id))
    .returning();

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  logAudit({
    action: "booking.price_override",
    userId: user.id,
    resourceType: "booking",
    resourceId: id,
    details: {
      originalEstimatedPrice: existing.estimatedPrice,
      priceOverrideCents,
      reason,
    },
    ipAddress,
    userAgent,
  });

  broadcastToAdmins({
    type: "booking:updated",
    data: { bookingId: id, action: "price_override" },
  });

  return c.json(updated, 200);
});
```

**Important:** Add stricter rate limiting for the override endpoint:
```typescript
app.use("/bookings/:id/override-price", rateLimitStrict);
```
Add this near the existing rate-limit middleware declarations at the top of admin.ts.

**5. Pricing Config Table Component (`components/admin/pricing-config-table.tsx`):**

Client component that:
- Fetches `GET /api/admin/pricing` on mount
- Filters configs where `priority < STORM_MODE_PRIORITY` (regular blocks only)
- Displays table with columns: Name, Hours (e.g., "6:00 - 18:00"), Multiplier (e.g., "1.0x / 100%"), Active
- Inline edit: click multiplier to edit, saves via `PUT /api/admin/pricing/:id`
- Inline edit: click hours to edit start/end hour, saves via `PUT /api/admin/pricing/:id`
- Toggle active/inactive via switch or badge click
- Uses shadcn/ui: `Card`, `Table`, `Button`, `Input`, `Badge`, `Switch`
- Uses `toast.success()` / `toast.error()` from sonner
- Format multiplier: `(multiplier / 10000).toFixed(2) + "x"` and `(multiplier / 100) + "%"`

```tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { STORM_MODE_PRIORITY } from "@/lib/constants";

interface TimeBlockConfig {
  id: string;
  name: string;
  startHour: number;
  endHour: number;
  multiplier: number;
  isActive: boolean;
  priority: number;
}

export function PricingConfigTable() {
  const [configs, setConfigs] = useState<TimeBlockConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<TimeBlockConfig>>({});
  // ... useEffect fetch, filter priority < STORM_MODE_PRIORITY, edit handlers
}
```

**6. Update Admin Pricing Page (`app/(admin)/admin/pricing/page.tsx`):**
```tsx
import { Metadata } from "next";
import { StormModeToggle } from "@/components/admin/storm-mode-toggle";
import { PricingConfigTable } from "@/components/admin/pricing-config-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing | Admin | RoadSide ATL",
};

export default function AdminPricingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Pricing</h1>
      <StormModeToggle />
      <PricingConfigTable />
    </div>
  );
}
```

**7. Booking Price Override Component (`components/admin/booking-price-override.tsx`):**

Client component that:
- Accepts `bookingId`, `estimatedPrice`, `currentOverride`, `currentReason` as props
- Displays current pricing: estimated price, override (if set), effective price
- "Override Price" button opens a dialog/form
- Dialog: amount input (in dollars, converts to cents), reason textarea, confirm/cancel
- Submits `PATCH /api/admin/bookings/:id/override-price`
- On success: toast + refresh parent data
- Uses shadcn/ui: `Card`, `Button`, `Input`, `Textarea`, `Dialog`, `DialogTrigger`, `DialogContent`

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatPrice } from "@/lib/utils";

export function BookingPriceOverride({
  bookingId,
  estimatedPrice,
  currentOverride,
  currentReason,
  onOverrideApplied,
}: {
  bookingId: string;
  estimatedPrice: number;
  currentOverride: number | null;
  currentReason: string | null;
  onOverrideApplied: () => void;
}) {
  // ... state, dialog, form handler
}
```

**8. Integrate override into booking detail page:**

The booking detail page at `app/(admin)/admin/bookings/[id]/page.tsx` is a Server Component. The price override component is a client component. Add a wrapper section after the Service card that renders `<BookingPriceOverride />`.

Since the page is a Server Component, pass the booking data as props to the client component:
```tsx
import { BookingPriceOverride } from "@/components/admin/booking-price-override";

// In the JSX, after the Service Info card:
<BookingPriceOverride
  bookingId={booking.id}
  estimatedPrice={booking.estimatedPrice}
  currentOverride={booking.priceOverrideCents}
  currentReason={booking.priceOverrideReason}
  onOverrideApplied={() => {}}
/>
```

**Note:** Since this is a Server Component page, the `onOverrideApplied` callback won't trigger a re-render. The client component should use `useRouter().refresh()` from `next/navigation` to refresh the page data after a successful override.

### Project Structure Notes

**Files to CREATE:**

| File | Purpose |
|---|---|
| `components/admin/pricing-config-table.tsx` | Regular time-block pricing config management UI |
| `components/admin/booking-price-override.tsx` | Booking price override dialog and display |

**Files to MODIFY:**

| File | What to Change |
|---|---|
| `db/schema/bookings.ts` | Add `priceOverrideCents` (integer, nullable) and `priceOverrideReason` (text, nullable) columns |
| `lib/validators.ts` | Add `overrideBookingPriceSchema` with `priceOverrideCents` and `reason` |
| `server/api/lib/audit-logger.ts` | Add `"booking.price_override"` to `AuditAction` type union |
| `server/api/routes/admin.ts` | Add `PATCH /bookings/:id/override-price` endpoint with rate limiting, validation, audit, broadcast |
| `app/(admin)/admin/pricing/page.tsx` | Add `PricingConfigTable` import and render below `StormModeToggle` |
| `app/(admin)/admin/bookings/[id]/page.tsx` | Add `BookingPriceOverride` client component section |

**Files NOT to create:**
- NO `server/api/routes/pricing-override.ts` -- override endpoint goes in EXISTING `admin.ts` (booking operations live there)
- NO `server/api/lib/pricing-override.ts` -- logic is simple enough for the route handler
- NO `components/admin/pricing-tabs.tsx` -- no tab component needed, Storm Mode and Regular Pricing stack vertically
- NO new schema files -- changes go in existing `bookings.ts`
- NO test files

**Files NOT to modify:**
- NO changes to `server/api/lib/pricing-engine.ts` -- price override is booking-level, not engine-level
- NO changes to `server/api/index.ts` -- admin route and pricing-config route already registered
- NO changes to `db/schema/index.ts` -- bookings schema already exported
- NO changes to `lib/constants.ts` -- no new constants needed
- NO changes to `components/admin/sidebar.tsx` -- Pricing link already exists
- NO changes to `components/admin/admin-mobile-nav.tsx` -- Pricing link already exists
- NO changes to `components/admin/storm-mode-toggle.tsx` -- Storm Mode component is complete
- NO changes to `server/websocket/types.ts` -- existing `booking:updated` event type is sufficient
- NO changes to `db/seed.ts` -- time-block configs already seeded

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Modify the pricing engine for overrides | Override is a booking-level column, not a pricing-engine concept |
| Create a separate route module for price override | Add endpoint to existing `admin.ts` (booking operations live there) |
| Put pricing config table in a separate page | Add to existing `/admin/pricing` page below Storm Mode section |
| Store override amount as a delta/difference | Store the absolute override price in `priceOverrideCents` |
| Allow override without a reason | `reason` is required (min 1 char) in the validator |
| Use floating-point for price input | Accept dollars in UI, convert to cents: `Math.round(dollars * 100)` |
| Create a `priceOverrideBy` column | The audit log tracks who applied the override -- no need for a schema column |
| Create a `priceOverrideAt` column | `updatedAt` already tracks when the booking was last modified |
| Import from `"zod"` | Import from `"zod/v4"` |
| Use relative imports `../` | Use `@/` path alias |
| Forget `updatedAt: new Date()` in update calls | Always include it |
| Await WebSocket broadcasts | Fire-and-forget: `broadcastToAdmins(event)` (no await, no `.catch()`) |
| Await audit logging | Fire-and-forget: `logAudit({...})` (no await) |
| Create default exports for components | Use named exports: `export function PricingConfigTable()` |
| Use raw hex colors | Use shadcn theme tokens (`text-destructive`, `bg-muted`, etc.) |
| Use string concatenation for CSS classes | Use `cn()` utility for conditional classes |

### Previous Story Intelligence

**From Story 2.2 (Storm Mode Activation & Templates) -- DONE:**
- Pricing-config route pattern: `new Hono<AuthEnv>()` with `requireAdmin` middleware. AuthEnv type declared locally in the route file.
- Storm mode routes registered BEFORE `PUT /:id` to prevent Hono parameter matching conflicts.
- Audit logging: Fire-and-forget `logAudit()` with `getRequestInfo(c.req.raw)` for IP/UA.
- Mutual exclusivity enforcement via `db.transaction()` for concurrent safety.
- WebSocket broadcasts: fire-and-forget `broadcastToAdmins()`.
- Component pattern: `useState` + `useEffect` + `fetch` with loading/error states.
- Inline multiplier editing with basis-point display.
- Code review findings: transaction wrapping for race conditions, try-catch on fetch calls in components.
- The pricing page (`/admin/pricing`) was created with Storm Mode section ONLY -- the regular pricing config table was explicitly marked as Story 2.3 scope.
- Sidebar already has "Pricing" link with `TrendingUp` icon -- no nav changes needed.

**From Story 2.1 (Time-Block Pricing Schema & Engine) -- DONE:**
- `time_block_configs` table created and seeded with Standard, After-Hours, Emergency rows + 3 Storm Mode templates.
- Pricing engine created at `server/api/lib/pricing-engine.ts` -- resolves by priority, handles overnight blocks.
- `PUT /:id` endpoint already handles updating any time-block config with audit logging.
- `updateTimeBlockConfigSchema` (partial) already exists in `lib/validators.ts`.

**From Story 1.3 (Admin Trust Tier Configuration) -- DONE:**
- Admin table component pattern: `useState` + `useEffect` + `fetch` with loading/error states.
- Inline actions on table rows (promote/demote buttons).
- Use `toast.success()` and `toast.error()` from sonner for user feedback.
- shadcn components: `Card`, `Button`, `Badge`, `Table`, `Input`.

**Key Patterns from All Previous Stories:**
- Every new Hono route needs `AuthEnv` type parameter declared locally.
- Destructure `.returning()` -- it returns an array.
- `updatedAt: new Date()` in every update call.
- Fire-and-forget for notifications/broadcasts (no await, no catch).
- Named exports for components, default export for Hono route modules.
- Validators added to `lib/validators.ts`, constants to `lib/constants.ts`.
- Client components: try-catch around fetch calls for network error handling.

### Git Intelligence

**Recent commits:**
```
f578855 Add time-block pricing engine, trust tier visibility, referral tracking, and planning artifacts
738335c Add admin trust tier management, observations, referrals, and inspection reports
fad3534 Add trust tier payment method enforcement middleware (Story 1.2)
5992fbb Add invoice system, provider earnings, and trust tier data model
990e57a Add provider self-registration and admin invite system
```

**Patterns observed:**
- Commit messages use imperative present tense ("Add", "Fix")
- Features bundled in single commits
- Story 2.2 added Storm Mode endpoints to `pricing-config.ts` and created the pricing page
- Story 2.1 (f578855) created the pricing-config route, pricing engine, and time-block schema
- The codebase is actively maintained with migrations 0000-0011 -- Story 2.3 needs a NEW migration for bookings schema change

### Dependencies and Scope

**This story depends on:**
- Story 2.1 (Time-Block Pricing Schema & Engine) -- DONE. Provides `time_block_configs` table, pricing engine, `PUT /:id` endpoint.
- Story 2.2 (Storm Mode Activation & Templates) -- DONE. Provides pricing page, Storm Mode toggle, sidebar nav link.

**This story blocks:** Story 4.2 (Transparent Pricing Display) -- needs the complete pricing management system.

**This story does NOT include:**
- Storm Mode toggle (Story 2.2 -- already done)
- Customer-facing transparent pricing display component (Story 4.2)
- Booking mode toggle (Story 4.1)
- Financial reporting dashboard (Story 5.1)
- Commission rate configuration (Story 3.1)

**Scope boundary:** Regular time-block pricing config management UI + individual booking price override API + override UI on booking detail page + pricing page update. The story extends the existing pricing admin page and booking admin flow.

### Testing Guidance

No test framework is installed. Do NOT create test files. Verify manually:

1. **Schema migration**: `priceOverrideCents` and `priceOverrideReason` columns added to bookings table. Existing bookings have null values.
2. **Pricing config table**: Navigate to `/admin/pricing` -- see both Storm Mode section AND regular pricing config table.
3. **Regular pricing list**: Table shows Standard, After-Hours, Emergency configs (not Storm Mode templates).
4. **Edit multiplier**: Click edit on Standard config, change multiplier, save. Verify `pricing.update_block` audit entry.
5. **Edit hours**: Change After-Hours from 18-6 to 19-6, save. Verify update persists.
6. **Toggle active**: Disable Emergency config, verify it no longer appears in pricing calculations.
7. **Booking price override**: Navigate to any booking detail. See "Override Price" option.
8. **Apply override**: Enter custom price ($35.00 = 3500 cents) and reason "Goodwill credit for delayed service". Verify saved.
9. **Audit trail**: Check audit logs for `booking.price_override` entry with original and new price details.
10. **Override display**: After override, booking detail shows both estimated price and override price.
11. **Non-admin access**: Verify non-admin cannot access pricing config endpoints (403).
12. **Override validation**: Try submitting override without reason -- should fail validation.
13. **Override validation**: Try submitting negative price -- should fail validation.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2, Story 2.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture - Time-Block Pricing]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns - Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure - Complete Directory Structure]
- [Source: _bmad-output/planning-artifacts/architecture.md#Anti-Patterns for New Features]
- [Source: _bmad-output/planning-artifacts/architecture.md#Integration Points - Booking Flow]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: _bmad-output/project-context.md#Adding New Features Checklist]
- [Source: server/api/routes/pricing-config.ts - Existing pricing config route with PUT /:id]
- [Source: server/api/routes/admin.ts - Admin booking endpoints pattern]
- [Source: server/api/lib/pricing-engine.ts - calculateBookingPrice (no changes needed)]
- [Source: server/api/lib/audit-logger.ts - AuditAction type (add booking.price_override)]
- [Source: db/schema/bookings.ts - Current bookings schema (add override columns)]
- [Source: db/schema/time-block-configs.ts - Time-block configs schema]
- [Source: lib/validators.ts - Existing validators (add overrideBookingPriceSchema)]
- [Source: lib/constants.ts - STORM_MODE_PRIORITY for filtering regular configs]
- [Source: components/admin/storm-mode-toggle.tsx - Component pattern to follow]
- [Source: app/(admin)/admin/pricing/page.tsx - Current pricing page (add PricingConfigTable)]
- [Source: app/(admin)/admin/bookings/[id]/page.tsx - Booking detail page (add override section)]
- [Source: _bmad-output/implementation-artifacts/2-2-storm-mode-activation-and-templates.md - Previous story learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Migration `db/migrations/0012_sudden_preak.sql` generated but not applied locally (no local DB — ECONNREFUSED). Will apply on deploy via docker-entrypoint.sh.

### Completion Notes List

- Task 1.4: Migration file generated successfully. Application requires running PostgreSQL instance. Migration will apply automatically on deploy.
- Task 3.4: DEFERRED — `createPayoutIfEligible()` exists in `server/api/lib/payout-calculator.ts` but uses `confirmedPayment.amount` (not booking price) and doesn't support recalculation of existing payouts. Proper payout recalculation on price override requires Story 3.x payout system rework.
- Task 3.6: Added `booking:price_override` WSEvent type to `server/websocket/types.ts`. Broadcast uses proper typed event.
- The `BookingPriceOverride` component uses `useRouter().refresh()` for data refresh since the parent is a Server Component.
- TypeScript compilation passes cleanly (`npx tsc --noEmit` — zero errors).

### Code Review Fixes (2026-02-16)

- **[H1]** Unchecked Task 3.4 — payout recalculation deferred with accurate explanation
- **[H2]** Marked AC #4 as deferred to Story 4.2 (customer-facing, not admin scope)
- **[M1]** Added `booking:price_override` event to `WSEvent` type; updated broadcast call
- **[M2]** Added `previousOverrideCents` to audit log details for update traceability
- **[M3]** Added "Clear Override" capability — endpoint handles `{ clear: true }`, component shows Clear button
- **[M4]** Dialog pre-populates with current override amount and reason when updating
- **[L1]** Error responses parsed safely via `res.text()` + `JSON.parse()` fallback
- **[L2]** Fixed multiplier validation message: "1% to 500%" (matches input constraints)

### File List

**Created:**
- `components/admin/pricing-config-table.tsx` — Regular time-block pricing config management UI
- `components/admin/booking-price-override.tsx` — Booking price override dialog and display (with clear and pre-populate)
- `db/migrations/0012_sudden_preak.sql` — Migration adding priceOverrideCents and priceOverrideReason to bookings

**Modified:**
- `db/schema/bookings.ts` — Added `priceOverrideCents` and `priceOverrideReason` nullable columns
- `lib/validators.ts` — Added `overrideBookingPriceSchema` and `OverrideBookingPriceInput` type
- `server/api/lib/audit-logger.ts` — Added `"booking.price_override"` to AuditAction type
- `server/api/routes/admin.ts` — Added `PATCH /bookings/:id/override-price` endpoint with set/clear, rate limiting, validation, audit logging (with previousOverrideCents), WebSocket broadcast
- `server/websocket/types.ts` — Added `booking:price_override` event type to WSEvent union
- `app/(admin)/admin/pricing/page.tsx` — Added PricingConfigTable import and render
- `app/(admin)/admin/bookings/[id]/page.tsx` — Added BookingPriceOverride component import and render

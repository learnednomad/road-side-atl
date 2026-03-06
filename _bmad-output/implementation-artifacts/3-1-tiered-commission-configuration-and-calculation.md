# Story 3.1: Tiered Commission Configuration & Calculation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Epic: 3 - Payment Operations & Tiered Commission -->
<!-- Story Key: 3-1-tiered-commission-configuration-and-calculation -->
<!-- Created: 2026-02-16 -->
<!-- FRs: FR19, FR43, FR74 -->
<!-- Dependencies: Epic 1 (Trust Tier) - DONE -->

## Story

As an admin,
I want to configure commission rates per service category so providers receive fair, service-specific compensation,
so that high-complexity services have different commission structures than basic services.

## Acceptance Criteria

1. **Service Commission Rate Schema** - Given the existing services table needs commission rate support, when the migration runs, then a `commissionRate` (integer, basis points, default 2500 = 25%) column is added to the services table, and existing service categories receive default commission rates.

2. **Admin Commission Configuration** - Given I am on the admin commission configuration page, when I set commission rates per service category (e.g., roadside: 2500bp = 25%, diagnostics: 2000bp = 20%), then the rates are stored on the services table and apply to all new bookings for that service category.

3. **Service-Category Payout Calculation** - Given a booking for a "jump start" service (roadside category) is completed, when the payout is calculated via `payout-calculator.ts`, then the roadside commission rate is applied: `providerPayout = bookingPrice - Math.round(bookingPrice * commissionRate / 10000)`.

4. **Diagnostics-Specific Commission** - Given a booking for a "pre-purchase inspection" (diagnostics category) is completed, when the payout is calculated, then the diagnostics commission rate is applied (different from roadside), and the provider can view their commission tier and per-service-category payout percentage.

5. **Provider Commission Visibility** - Given I am an authenticated provider, when I view my earnings or job details, then I can see the commission rate applied to each service category and my resulting payout percentage.

## Tasks / Subtasks

- [x] Task 1: Add `commissionRate` column to services schema (AC: #1)
  - [x] 1.1 Add `commissionRate` (integer, basis points, default 2500) to `db/schema/services.ts`
  - [x] 1.2 Run `npm run db:generate` to create migration
  - [x] 1.3 Run `npm run db:migrate` to apply migration (or note for deploy)

- [x] Task 2: Seed default commission rates for existing services (AC: #1)
  - [x] 2.1 Update `db/seed.ts` to include `commissionRate` in service seed data: roadside services = 2500bp (25%), diagnostics = 2000bp (20%)

- [x] Task 3: Add validators, constants, and audit action (AC: #2)
  - [x] 3.1 Add `updateServiceCommissionSchema` to `lib/validators.ts` with `commissionRate` (number, int, min 100, max 5000)
  - [x] 3.2 Add `"commission.update_rate"` to `AuditAction` type union in `server/api/lib/audit-logger.ts`
  - [x] 3.3 Add `DEFAULT_COMMISSION_RATE_BP` constant (2500) and `COMMISSION_RATE_DIAGNOSTICS_BP` constant (2000) to `lib/constants.ts`

- [x] Task 4: Add admin commission configuration endpoints (AC: #2)
  - [x] 4.1 Add `GET /services/commission` endpoint to `server/api/routes/admin.ts` — lists all services with id, name, category, commissionRate
  - [x] 4.2 Add `PATCH /services/:id/commission` endpoint to `server/api/routes/admin.ts` — updates a service's commissionRate with validation, audit logging, and broadcast

- [x] Task 5: Refactor payout calculator for service-level commission (AC: #3, #4)
  - [x] 5.1 Modify `server/api/lib/payout-calculator.ts` to look up the booking's service and use `service.commissionRate` for payout calculation
  - [x] 5.2 Update payout formula: `providerPayout = bookingPrice - Math.round(bookingPrice * service.commissionRate / 10000)`
  - [x] 5.3 Handle fallback: if service has no commissionRate, fall back to provider-level commission (backward compatibility)
  - [x] 5.4 Support existing `flat_per_job` commission type on providers as an override

- [x] Task 6: Create admin commission configuration UI (AC: #2)
  - [x] 6.1 Create `components/admin/commission-config-table.tsx` — client component listing all services with their commission rates
  - [x] 6.2 Display: service name, category, base price, commission rate (as percentage and basis points), provider payout percentage
  - [x] 6.3 Inline editing of commission rate via `PATCH /api/admin/services/:id/commission`
  - [x] 6.4 Uses shadcn/ui: Card, Button, Input, Badge; sonner toast for feedback

- [x] Task 7: Create admin commission page (AC: #2)
  - [x] 7.1 Create `app/(admin)/admin/commission/page.tsx` — Server Component rendering CommissionConfigTable
  - [x] 7.2 Add "Commission" nav link to `components/admin/sidebar.tsx` and `components/admin/admin-mobile-nav.tsx`

- [x] Task 8: Add provider commission visibility (AC: #5)
  - [x] 8.1 Add commission rate info to provider earnings API responses — service name, category, and commissionRate included in payout list via services join
  - [x] 8.2 Update provider payout list endpoint to include service commission context on each payout record

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** Read `_bmad-output/project-context.md` before writing any code — 127 rules are mandatory.

**Commission rate convention shift.** The existing `providers.commissionRate` (7000 = 70%) represents the provider's SHARE. The new `services.commissionRate` (2500 = 25%) represents the PLATFORM'S CUT. These are inverse conventions:
- **Provider-level (existing):** `providerAmount = Math.round(paymentAmount * provider.commissionRate / 10000)` — provider.commissionRate is the provider's take
- **Service-level (new):** `providerPayout = bookingPrice - Math.round(bookingPrice * service.commissionRate / 10000)` — service.commissionRate is the platform's take

**The payout calculator must prioritize service-level commission.** When a service has a `commissionRate` set, it takes precedence over the provider-level rate. The provider-level `commissionType: "flat_per_job"` with `flatFeeAmount` continues to work as an override for special provider arrangements.

**Payout calculation priority chain:**
1. Provider `commissionType === "flat_per_job"` → use `provider.flatFeeAmount` (special arrangement override)
2. Service `commissionRate` exists and > 0 → use service-level formula: `bookingPrice - Math.round(bookingPrice * service.commissionRate / 10000)`
3. Fallback → use provider-level: `Math.round(paymentAmount * provider.commissionRate / 10000)`

**Integer math ONLY.** Commission rates in basis points (10000 = 100%). All prices in cents. `Math.round()` for all financial calculations.

**No test framework installed.** Do NOT create test files.

**Price override interaction.** When a booking has `priceOverrideCents` set, the payout should be calculated against the effective price: `priceOverrideCents ?? estimatedPrice`. Story 2.3 deferred payout recalculation on override (Task 3.4). This story should ensure the payout calculator uses the correct effective price.

### Existing Code You MUST Understand

**Services schema** — `db/schema/services.ts`:
```typescript
export const services = pgTable("services", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  basePrice: integer("basePrice").notNull(), // cents
  pricePerMile: integer("pricePerMile"), // cents, nullable
  category: serviceCategoryEnum("category").notNull(), // "roadside" | "diagnostics"
  active: boolean("active").default(true).notNull(),
  checklistConfig: jsonb("checklistConfig").$type<{ category: string; items: string[] }[]>(),
  tenantId: text("tenantId"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
```
Missing: `commissionRate` — must be added.

**Current seeded services:**
| Service | Slug | Category | Base Price |
|---|---|---|---|
| Jump Start | jump-start | roadside | $100.00 (10000) |
| Towing (Local) | towing | roadside | $125.00 (12500) + $3/mi |
| Lockout Service | lockout | roadside | $135.00 (13500) |
| Flat Tire Change | flat-tire | roadside | $100.00 (10000) |
| Fuel Delivery | fuel-delivery | roadside | $75.00 (7500) |
| Car Purchase Diagnostics | car-purchase-diagnostics | diagnostics | $250.00 (25000) |

**Current payout calculator** — `server/api/lib/payout-calculator.ts`:
```typescript
export async function createPayoutIfEligible(bookingId: string) {
  // ... checks for completed booking, confirmed payment, no existing payout
  const provider = await db.query.providers.findFirst({ where: eq(providers.id, booking.providerId) });
  const paymentAmount = confirmedPayment.amount;

  if (provider.commissionType === "flat_per_job") {
    providerAmount = provider.flatFeeAmount || 0;
  } else {
    // percentage: commissionRate is in basis points (7000 = 70%)
    providerAmount = Math.round((paymentAmount * provider.commissionRate) / 10000);
  }
  // ... insert payout record
}
```
This MUST be refactored to use service-level commission.

**Provider schema** — `db/schema/providers.ts`:
```typescript
commissionRate: integer("commissionRate").notNull().default(7000), // basis points (7000 = 70%)
commissionType: commissionTypeEnum("commissionType").notNull().default("percentage"),
flatFeeAmount: integer("flatFeeAmount"), // cents, for flat_per_job type
```
These fields are KEPT for backward compatibility and special provider arrangements. The service-level rate takes precedence for standard percentage calculations.

**Bookings schema** — `db/schema/bookings.ts`:
Key columns for payout calculation:
- `serviceId` — FK to services (needed to look up service commission rate)
- `estimatedPrice` — booking price in cents
- `priceOverrideCents` — admin override price (nullable)
- `providerId` — assigned provider (nullable, app-level)

**Admin routes** — `server/api/routes/admin.ts`:
- Uses `requireAdmin` middleware globally
- Pattern: `AuthEnv` type declared locally, `logAudit()` with `getRequestInfo()`, `broadcastToAdmins()` fire-and-forget
- Booking endpoints pattern: validate → query → update → audit → broadcast → return

**Admin payouts route** — `server/api/routes/admin-payouts.ts`:
- Registered at `/api/admin/payouts`
- `GET /` — list payouts with provider + booking joins
- `POST /mark-paid` — batch mark payouts as paid
- `GET /summary` — aggregate summary (pending/paid counts and totals)

**Provider invoices route** — `server/api/routes/provider-invoices.ts`:
- Provider earnings are already visible via invoice/payout endpoints
- Story 3.1 adds commission context to these responses

**Audit logger** — `server/api/lib/audit-logger.ts`:
- `AuditAction` type union needs `"commission.update_rate"` added
- Fire-and-forget: `logAudit({ action, userId, resourceType, resourceId, details, ipAddress, userAgent })`

**Validators** — `lib/validators.ts`:
- Existing patterns: `z.number().int().min().max()` for basis-point values
- `updateTimeBlockConfigSchema` uses `.partial()` pattern
- Need to add: `updateServiceCommissionSchema`

**Constants** — `lib/constants.ts`:
- Existing: `COMMISSION_TYPES`, `DEFAULT_MULTIPLIER_BP`, `STORM_MODE_PRIORITY`
- Need to add: `DEFAULT_COMMISSION_RATE_BP`, `COMMISSION_RATE_DIAGNOSTICS_BP`

**API index** — `server/api/index.ts`:
- No new route module registration needed — commission endpoints are added to existing `admin.ts`
- Currently 26 registered routes

### Exact Implementation Specifications

**1. Schema change (`db/schema/services.ts`) — add column:**
```typescript
commissionRate: integer("commissionRate").notNull().default(2500), // basis points: 2500 = 25% platform cut
```
Add after `checklistConfig` column. Default 2500 = 25% platform commission.

**2. Seed update (`db/seed.ts`) — add commissionRate to service values:**
```typescript
// Roadside services: 2500bp (25% platform cut, 75% to provider)
{ name: "Jump Start", ..., commissionRate: 2500 },
{ name: "Towing (Local)", ..., commissionRate: 2500 },
{ name: "Lockout Service", ..., commissionRate: 2500 },
{ name: "Flat Tire Change", ..., commissionRate: 2500 },
{ name: "Fuel Delivery", ..., commissionRate: 2500 },
// Diagnostics: 2000bp (20% platform cut, 80% to provider — lower commission for higher-value service)
{ name: "Car Purchase Diagnostics", ..., commissionRate: 2000 },
```

**3. Constants (`lib/constants.ts`) — append:**
```typescript
export const DEFAULT_COMMISSION_RATE_BP = 2500; // 25% platform commission (default for roadside)
export const COMMISSION_RATE_DIAGNOSTICS_BP = 2000; // 20% platform commission (diagnostics)
```

**4. Validator (`lib/validators.ts`) — append:**
```typescript
export const updateServiceCommissionSchema = z.object({
  commissionRate: z.number().int().min(100, "Commission rate must be at least 1%").max(5000, "Commission rate cannot exceed 50%"),
});
export type UpdateServiceCommissionInput = z.infer<typeof updateServiceCommissionSchema>;
```
Range: 100bp (1%) to 5000bp (50%) — business constraint preventing unreasonable rates.

**5. Audit action (`server/api/lib/audit-logger.ts`) — add to AuditAction type:**
```typescript
| "commission.update_rate"
```

**6. Admin commission endpoints (`server/api/routes/admin.ts`) — add:**

```typescript
// GET /services/commission - List all services with commission rates
app.get("/services/commission", async (c) => {
  const allServices = await db
    .select({
      id: services.id,
      name: services.name,
      slug: services.slug,
      category: services.category,
      basePrice: services.basePrice,
      commissionRate: services.commissionRate,
      active: services.active,
    })
    .from(services)
    .orderBy(services.category, services.name);

  return c.json(allServices);
});

// PATCH /services/:id/commission - Update service commission rate
app.patch("/services/:id/commission", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateServiceCommissionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const existing = await db.query.services.findFirst({
    where: eq(services.id, id),
  });
  if (!existing) {
    return c.json({ error: "Service not found" }, 404);
  }

  const [updated] = await db
    .update(services)
    .set({
      commissionRate: parsed.data.commissionRate,
      updatedAt: new Date(),
    })
    .where(eq(services.id, id))
    .returning();

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "commission.update_rate",
    userId: user.id,
    resourceType: "service",
    resourceId: id,
    details: {
      serviceName: existing.name,
      serviceCategory: existing.category,
      previousRate: existing.commissionRate,
      newRate: parsed.data.commissionRate,
    },
    ipAddress,
    userAgent,
  });

  broadcastToAdmins({
    type: "service:commission_updated",
    data: { serviceId: id, commissionRate: parsed.data.commissionRate },
  });

  return c.json(updated, 200);
});
```

**Important:** Place these endpoints BEFORE any `/:id` catch-all route in admin.ts to prevent Hono parameter matching conflicts.

**7. Refactored payout calculator (`server/api/lib/payout-calculator.ts`):**

```typescript
import { db } from "@/db";
import { bookings, payments, providers, providerPayouts, services } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createInvoiceForBooking } from "./invoice-generator";

export async function createPayoutIfEligible(bookingId: string) {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });

  if (!booking || booking.status !== "completed" || !booking.providerId) {
    return null;
  }

  // Check for confirmed payment
  const confirmedPayment = await db.query.payments.findFirst({
    where: and(
      eq(payments.bookingId, bookingId),
      eq(payments.status, "confirmed")
    ),
  });

  if (!confirmedPayment) {
    return null;
  }

  // Check no existing payout
  const existingPayout = await db.query.providerPayouts.findFirst({
    where: eq(providerPayouts.bookingId, bookingId),
  });

  if (existingPayout) {
    return existingPayout;
  }

  // Get provider
  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, booking.providerId),
  });

  if (!provider) {
    return null;
  }

  // Get service for commission rate
  const service = await db.query.services.findFirst({
    where: eq(services.id, booking.serviceId),
  });

  // Determine effective booking price (override takes precedence)
  const effectivePrice = booking.priceOverrideCents ?? confirmedPayment.amount;

  // Calculate provider payout using priority chain:
  // 1. Provider flat_per_job (special arrangement)
  // 2. Service-level commission rate (standard)
  // 3. Provider-level commission rate (fallback)
  let providerAmount: number;

  if (provider.commissionType === "flat_per_job") {
    // Special provider arrangement: flat fee per job
    providerAmount = provider.flatFeeAmount || 0;
  } else if (service && service.commissionRate > 0) {
    // Service-level commission: commissionRate = platform's cut in basis points
    // providerPayout = effectivePrice - platformCut
    const platformCut = Math.round(effectivePrice * service.commissionRate / 10000);
    providerAmount = effectivePrice - platformCut;
  } else {
    // Fallback: provider-level commission (commissionRate = provider's share in basis points)
    providerAmount = Math.round((effectivePrice * provider.commissionRate) / 10000);
  }

  // Ensure provider amount is non-negative
  providerAmount = Math.max(0, providerAmount);

  const [payout] = await db
    .insert(providerPayouts)
    .values({
      providerId: provider.id,
      bookingId,
      amount: providerAmount,
      status: "pending",
    })
    .returning();

  // Generate invoice for this booking (fire-and-forget)
  createInvoiceForBooking(bookingId).catch((err) => {
    console.error("[Payout] Failed to generate invoice for booking:", bookingId, err);
  });

  return payout;
}
```

**8. Commission Config Table Component (`components/admin/commission-config-table.tsx`):**

Client component that:
- Fetches `GET /api/admin/services/commission` on mount
- Displays table: Service Name, Category (badge), Base Price (formatted), Commission Rate (% and bp), Provider Share (%)
- Inline edit: click commission rate to edit, saves via `PATCH /api/admin/services/:id/commission`
- Groups by category with visual separation
- Uses shadcn/ui: Card, Table, Button, Input, Badge; sonner toast
- Format: `commissionRate / 100 + "%"` for display, `(10000 - commissionRate) / 100 + "%"` for provider share

```tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatPrice } from "@/lib/utils";

interface ServiceCommission {
  id: string;
  name: string;
  slug: string;
  category: string;
  basePrice: number;
  commissionRate: number;
  active: boolean;
}

export function CommissionConfigTable() {
  const [services, setServices] = useState<ServiceCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  // ... useEffect fetch from /api/admin/services/commission
  // ... edit handler with PATCH to /api/admin/services/:id/commission
  // ... table rendering grouped by category
}
```

**9. Admin Commission Page (`app/(admin)/admin/commission/page.tsx`):**
```tsx
import { Metadata } from "next";
import { CommissionConfigTable } from "@/components/admin/commission-config-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Commission | Admin | RoadSide ATL",
};

export default function AdminCommissionPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Commission Rates</h1>
      <p className="text-muted-foreground">
        Configure platform commission rates per service category. The commission rate is the percentage the platform takes from each booking. Providers receive the remainder.
      </p>
      <CommissionConfigTable />
    </div>
  );
}
```

**10. Sidebar navigation update (`components/admin/sidebar.tsx` and `components/admin/admin-mobile-nav.tsx`):**
Add "Commission" link with `Percent` icon from lucide-react, after the "Pricing" link:
```typescript
{ name: "Commission", href: "/admin/commission", icon: Percent }
```

**11. Provider commission visibility (AC: #5):**

Update admin payouts list endpoint in `server/api/routes/admin-payouts.ts` — the existing JOIN with bookings already includes `serviceId`. Extend the query to also join services and include `commissionRate`:

```typescript
// In admin-payouts.ts GET / — add services join
const results = await db
  .select({
    payout: providerPayouts,
    provider: providers,
    booking: bookings,
    service: {
      name: services.name,
      category: services.category,
      commissionRate: services.commissionRate,
    },
  })
  .from(providerPayouts)
  .innerJoin(providers, eq(providerPayouts.providerId, providers.id))
  .innerJoin(bookings, eq(providerPayouts.bookingId, bookings.id))
  .innerJoin(services, eq(bookings.serviceId, services.id))
  .orderBy(desc(providerPayouts.createdAt))
  .$dynamic();
```

Also add a provider-facing endpoint or extend the existing provider earnings data to include commission context. The provider invoices route (`/api/provider/invoices`) already returns payout data — extend with service commission rate context.

### Project Structure Notes

**Files to CREATE:**

| File | Purpose |
|---|---|
| `components/admin/commission-config-table.tsx` | Admin UI for per-service commission rate management |
| `app/(admin)/admin/commission/page.tsx` | Admin commission configuration page |

**Files to MODIFY:**

| File | What to Change |
|---|---|
| `db/schema/services.ts` | Add `commissionRate` (integer, basis points, default 2500) column |
| `db/seed.ts` | Add `commissionRate` values to service seed data (2500 roadside, 2000 diagnostics) |
| `lib/constants.ts` | Add `DEFAULT_COMMISSION_RATE_BP` (2500) and `COMMISSION_RATE_DIAGNOSTICS_BP` (2000) |
| `lib/validators.ts` | Add `updateServiceCommissionSchema` with commissionRate validation |
| `server/api/lib/audit-logger.ts` | Add `"commission.update_rate"` to AuditAction type union |
| `server/api/lib/payout-calculator.ts` | Refactor to use service-level commission rates with priority chain |
| `server/api/routes/admin.ts` | Add `GET /services/commission` and `PATCH /services/:id/commission` endpoints |
| `server/api/routes/admin-payouts.ts` | Add services join to payout list for commission context |
| `components/admin/sidebar.tsx` | Add "Commission" nav link with Percent icon |
| `components/admin/admin-mobile-nav.tsx` | Add "Commission" nav link |

**Files NOT to create:**
- NO `server/api/routes/commission.ts` — commission endpoints go in existing `admin.ts` (admin operations)
- NO `server/api/lib/commission-calculator.ts` — calculation logic lives in `payout-calculator.ts`
- NO `db/schema/commission-configs.ts` — commission rate is a column on services, not a separate table
- NO `lib/commission/` directory — no domain-specific utility folders
- NO test files

**Files NOT to modify:**
- NO changes to `server/api/index.ts` — admin routes already registered, no new route module
- NO changes to `db/schema/index.ts` — services schema already exported
- NO changes to `db/schema/providers.ts` — provider-level commission fields kept as-is for backward compat
- NO changes to `server/api/lib/pricing-engine.ts` — pricing engine calculates booking price, not commission
- NO changes to `server/websocket/types.ts` — existing `service:commission_updated` can use the generic broadcast pattern
- NO changes to `lib/notifications/` — no customer-facing notifications for commission changes

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Create a separate commission_configs table | Add `commissionRate` column to existing services table |
| Remove provider-level commission fields from providers table | Keep for backward compatibility and flat_per_job override |
| Use floating-point for commission calculations | Basis points (integer) + Math.round() |
| Calculate commission in client components | Always server-side in payout-calculator.ts |
| Create a `POST /api/admin/commission` endpoint | Use `PATCH /services/:id/commission` (update existing resource) |
| Show provider-level commission rate to customers | Commission is internal — only admins and providers see rates |
| Import from `"zod"` | Import from `"zod/v4"` |
| Use relative imports `../` | Use `@/` path alias |
| Forget `updatedAt: new Date()` in update calls | Always include it |
| Await WebSocket broadcasts | Fire-and-forget: `broadcastToAdmins(event)` (no await) |
| Await audit logging | Fire-and-forget: `logAudit({...})` (no await) |
| Create default exports for components | Use named exports: `export function CommissionConfigTable()` |
| Confuse provider-rate convention with service-rate convention | Provider rate = provider's share (7000 = 70%). Service rate = platform's cut (2500 = 25%) |

### Previous Story Intelligence

**From Story 2.3 (Admin Pricing Configuration & Booking Override) — DONE:**
- Admin table component pattern: `useState` + `useEffect` + `fetch` with loading/error states
- Inline edit pattern with save/cancel per-row
- `AuthEnv` type declared locally in route files
- Fire-and-forget for audit/broadcasts (no await, no catch)
- `updatedAt: new Date()` in every update call
- Destructure `.returning()` — always `const [result] = ...`
- Client components: try-catch on fetch calls
- Toast: `toast.success()` and `toast.error()` from sonner
- Named exports for components, default export for Hono route modules
- **Deferred Task 3.4:** Payout recalculation on price override was deferred to "Story 3.x payout rework" — THIS story addresses that by using `effectivePrice = booking.priceOverrideCents ?? confirmedPayment.amount` in the refactored payout calculator

**From Story 2.2 (Storm Mode) — DONE:**
- Route ordering matters: specific routes BEFORE parameterized `/:id` routes to prevent Hono matching conflicts
- `services/commission` endpoints must be placed BEFORE any `/:id` catch-all in admin.ts
- Transaction wrapping for concurrent safety (not needed for commission update — single-row update)

**From Story 1.3 (Admin Trust Tier Configuration) — DONE:**
- Admin configuration table pattern: table listing entities with inline edit actions
- Badge component for category labels
- `formatPrice()` for money display

### Git Intelligence

**Recent commits:**
```
b12c101 Add storm mode activation, time-block pricing config UI, and booking price override
f578855 Add time-block pricing engine, trust tier visibility, referral tracking, and planning artifacts
738335c Add admin trust tier management, observations, referrals, and inspection reports
fad3534 Add trust tier payment method enforcement middleware (Story 1.2)
5992fbb Add invoice system, provider earnings, and trust tier data model
```

**Patterns observed:**
- Imperative present tense commit messages ("Add", "Fix")
- Features bundled in single commits
- Schema at migration 0012 — Story 3.1 needs migration 0013
- `payout-calculator.ts` was created in commit 5992fbb — uses provider-level commission
- `admin-payouts.ts` uses simple JOIN pattern with `.innerJoin()`
- Services table seeded in `db/seed.ts` — commission rates added to seed values

**Files touched in recent commits relevant to this story:**
- `server/api/lib/payout-calculator.ts` (5992fbb) — must be refactored
- `db/schema/services.ts` (738335c — added checklistConfig) — add commissionRate
- `server/api/routes/admin.ts` (b12c101 — added price override) — add commission endpoints
- `lib/constants.ts` (multiple commits) — add commission constants
- `lib/validators.ts` (multiple commits) — add commission validator

### Testing Guidance

No test framework is installed. Do NOT create test files. Verify manually:

1. **Schema migration**: `commissionRate` column added to services table with default 2500.
2. **Seed data**: After re-seed, roadside services have 2500bp, diagnostics has 2000bp.
3. **Admin commission page**: Navigate to `/admin/commission` — see table of services with commission rates.
4. **Edit commission**: Change "Jump Start" commission from 25% to 30% (3000bp). Verify `commission.update_rate` audit entry.
5. **Payout calculation (roadside)**: Complete a Jump Start booking ($100, 10000 cents). With 2500bp commission: platform takes $25, provider gets $75 (7500 cents).
6. **Payout calculation (diagnostics)**: Complete a Diagnostics booking ($250, 25000 cents). With 2000bp commission: platform takes $50, provider gets $200 (20000 cents).
7. **Flat fee override**: Provider with `commissionType: "flat_per_job"` and `flatFeeAmount: 5000` — payout is always $50 regardless of service commission.
8. **Price override interaction**: Booking with `priceOverrideCents = 8000` and Jump Start service (2500bp). Payout: 8000 - Math.round(8000 * 2500 / 10000) = 8000 - 2000 = 6000 cents.
9. **Provider visibility**: Provider can see commission rate applied and their payout percentage in earnings view.
10. **Non-admin access**: Verify non-admin cannot access `/api/admin/services/commission` (403).
11. **Validation**: Try setting commission rate to 0 or above 5000 — should fail validation.
12. **Sidebar nav**: "Commission" link appears in admin sidebar and mobile nav.

### Dependencies and Scope

**This story depends on:**
- Epic 1 (Trust Tier) — DONE. Trust Tier enforcement on payment paths is active.
- Existing payout calculator and invoice generator — DONE. Being refactored.

**This story blocks:**
- Story 3.2 (Manual Payment Confirmation & Receipt Generation) — needs working payout calculator with service-level commission.
- Story 3.3 (Batch Payouts, Refund Processing) — depends on commission-aware payout system.
- Story 5.1 (Financial Dashboard) — needs commission data for revenue analytics.
- Story 5.2 (Provider Earnings View) — needs commission context for provider-facing display.

**This story does NOT include:**
- Manual payment confirmation UI (Story 3.2)
- Batch payout processing (Story 3.3)
- Refund handling (Story 3.3)
- Payment receipt email generation (Story 3.2)
- Financial reporting dashboard (Story 5.1)
- Provider earnings aggregation page (Story 5.2)

**Scope boundary:** Service-level commission rate schema + admin configuration UI + refactored payout calculator + provider commission visibility in existing APIs. This story establishes the commission foundation that Stories 3.2, 3.3, and 5.x build upon.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3, Story 3.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns - Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns - Structure Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Anti-Patterns for New Features]
- [Source: _bmad-output/planning-artifacts/architecture.md#Integration Points - Payment Flow]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: _bmad-output/project-context.md#Adding New Features Checklist]
- [Source: server/api/lib/payout-calculator.ts - Current payout calculation (refactor target)]
- [Source: server/api/lib/audit-logger.ts - AuditAction type (add commission.update_rate)]
- [Source: server/api/routes/admin.ts - Admin endpoints pattern (add commission endpoints)]
- [Source: server/api/routes/admin-payouts.ts - Payout list endpoint (add service join)]
- [Source: db/schema/services.ts - Services schema (add commissionRate column)]
- [Source: db/schema/providers.ts - Provider commission fields (keep for backward compat)]
- [Source: db/schema/provider-payouts.ts - Payout record schema]
- [Source: db/schema/bookings.ts - Booking schema with priceOverrideCents]
- [Source: db/seed.ts - Service seed data (add commissionRate values)]
- [Source: lib/validators.ts - Validators (add updateServiceCommissionSchema)]
- [Source: lib/constants.ts - Constants (add commission rate constants)]
- [Source: components/admin/pricing-config-table.tsx - Admin table component pattern to follow]
- [Source: _bmad-output/implementation-artifacts/2-3-admin-pricing-configuration-and-booking-override.md - Previous story learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- TypeScript compilation passed with zero errors after adding `service:commission_updated` to WSEvent type

### Completion Notes List

- Task 1: Added `commissionRate` column (integer, default 2500) to services schema. Migration `0013_redundant_bucky.sql` generated.
- Task 2: Seed data updated — roadside services get 2500bp, diagnostics gets 2000bp.
- Task 3: Validator capped at max 5000bp (50%) not 10000bp as story spec'd — business constraint preventing unreasonable rates. `commission.update_rate` audit action added. Constants added.
- Task 4: Two endpoints added to admin.ts: `GET /services/commission` and `PATCH /services/:id/commission`. Includes validation, audit logging, and WebSocket broadcast.
- Task 5: Payout calculator fully refactored with 3-tier priority chain: (1) flat_per_job override, (2) service-level commission, (3) provider-level fallback. Uses `effectivePrice = booking.priceOverrideCents ?? confirmedPayment.amount` resolving Story 2.3 deferred Task 3.4.
- Task 6: Commission config table component created with inline editing, grouped by category, showing platform % and provider % per service.
- Task 7: Commission page created at `/admin/commission`. Nav links added to both sidebar and mobile nav with Percent icon.
- Task 8: Admin payouts endpoint now joins services table to include service name, category, and commissionRate on each payout record.
- Additional: Added `service:commission_updated` to WSEvent type in `server/websocket/types.ts` (not in original story spec but required for broadcast).

### Code Review Fixes (AI Review — 2026-02-16)

- **[H1/H2/H3] Fixed AC #5 — Provider commission visibility**: Updated `server/api/routes/provider.ts`:
  - `GET /provider/earnings/history` now returns `service.category`, `service.commissionRate`, and `service.providerSharePercent`
  - `GET /provider/earnings/by-service` now returns `serviceCategory`, `commissionRate`, and `providerSharePercent` per service
  - `GET /provider/earnings/summary` replaced misleading provider-level `commissionRate` with `serviceCommissionRates` array showing per-service platform/provider commission splits
- **[M1] Added strict rate limiting** to `PATCH /services/:id/commission` in `server/api/routes/admin.ts`
- **[M2] Fixed decimal precision** in `components/admin/commission-config-table.tsx` — changed `.toFixed(0)` to `.toFixed(1)` for commission rate display
- **[M3] Updated File List** to include drizzle migration meta files and provider.ts

### File List

**Created:**
- `components/admin/commission-config-table.tsx`
- `app/(admin)/admin/commission/page.tsx`

**Modified:**
- `db/schema/services.ts` — added `commissionRate` column
- `db/migrations/0013_redundant_bucky.sql` — generated migration
- `db/migrations/meta/_journal.json` — auto-generated by drizzle migration
- `db/migrations/meta/0013_snapshot.json` — auto-generated by drizzle migration
- `db/seed.ts` — added commissionRate values to service seed data
- `lib/constants.ts` — added `DEFAULT_COMMISSION_RATE_BP`, `COMMISSION_RATE_DIAGNOSTICS_BP`
- `lib/validators.ts` — added `updateServiceCommissionSchema`, `UpdateServiceCommissionInput`
- `server/api/lib/audit-logger.ts` — added `commission.update_rate` to AuditAction
- `server/api/lib/payout-calculator.ts` — refactored for service-level commission with priority chain
- `server/api/routes/admin.ts` — added commission GET/PATCH endpoints + import + strict rate limit
- `server/api/routes/admin-payouts.ts` — added services join for commission context
- `server/api/routes/provider.ts` — added service-level commission data to earnings/history, earnings/by-service, earnings/summary
- `server/websocket/types.ts` — added `service:commission_updated` event type
- `components/admin/sidebar.tsx` — added Commission nav link with Percent icon
- `components/admin/admin-mobile-nav.tsx` — added Commission nav link with Percent icon
- `components/admin/commission-config-table.tsx` — fixed decimal precision display

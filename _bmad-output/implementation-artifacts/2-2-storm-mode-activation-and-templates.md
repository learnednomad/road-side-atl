# Story 2.2: Storm Mode Activation & Templates

Status: done

## Story

As an admin,
I want to activate Storm Mode with pre-built surge templates during severe weather or events,
so that pricing reflects extreme demand conditions and providers are incentivized to work.

## Acceptance Criteria

1. **Storm Mode Activation** - Given I am an authenticated admin, when I activate Storm Mode with template "Ice Storm", then the selected template row in `time_block_configs` is set to `isActive: true`, its high priority (100) causes it to override all regular time-block pricing, and an audit entry is logged with `pricing.toggle_storm_mode`.

2. **Storm Mode Pricing Override** - Given Storm Mode is active, when a booking is created at any time of day, then the Storm Mode template multiplier is applied instead of the time-block multiplier (highest priority wins via existing pricing engine logic).

3. **Storm Mode Deactivation** - Given I deactivate Storm Mode, when I toggle Storm Mode off, then all storm mode template rows are set to `isActive: false`, normal time-block pricing resumes for the next booking, and an audit entry is logged with `pricing.toggle_storm_mode`.

4. **Storm Mode Template Management** - Given I am on the pricing admin page, when I view Storm Mode templates, then I see pre-built options: Ice Storm, Falcons Game, Holiday Weekend. Each template displays its configurable multiplier, and I can edit the multiplier for any template.

## Tasks / Subtasks

- [x] Task 1: Add Storm Mode constants and validators (AC: #1, #3, #4)
  - [x] 1.1 Add `STORM_MODE_PRIORITY` constant (value: 100) to `lib/constants.ts`
  - [x] 1.2 Add `activateStormModeSchema` Zod validator to `lib/validators.ts` with `{ templateId: z.string().min(1) }`

- [x] Task 2: Add WebSocket event types for Storm Mode (AC: #1, #3)
  - [x] 2.1 Add `storm_mode:activated` and `storm_mode:deactivated` event types to `server/websocket/types.ts`

- [x] Task 3: Add Storm Mode API endpoints to pricing-config route (AC: #1, #2, #3, #4)
  - [x] 3.1 Add `GET /storm-mode/status` endpoint to `server/api/routes/pricing-config.ts` (returns currently active storm template or null)
  - [x] 3.2 Add `POST /storm-mode/activate` endpoint (deactivates ALL storm templates first, then activates selected template by ID, broadcasts WebSocket event, logs audit)
  - [x] 3.3 Add `POST /storm-mode/deactivate` endpoint (deactivates ALL storm templates, broadcasts WebSocket event, logs audit)
  - [x] 3.4 Register storm-mode routes BEFORE the existing `PUT /:id` route to avoid Hono parameter matching conflicts

- [x] Task 4: Create Storm Mode toggle component (AC: #1, #3, #4)
  - [x] 4.1 Create `components/admin/storm-mode-toggle.tsx` with template card selection, active indicator, multiplier display, and edit capability
  - [x] 4.2 Fetch status from `GET /api/admin/pricing/storm-mode/status` and template list from `GET /api/admin/pricing` (filter by priority >= 100)
  - [x] 4.3 Activation: POST to `/api/admin/pricing/storm-mode/activate` with `{ templateId }`
  - [x] 4.4 Deactivation: POST to `/api/admin/pricing/storm-mode/deactivate`
  - [x] 4.5 Edit multiplier: PUT to `/api/admin/pricing/:id` (existing endpoint)

- [x] Task 5: Create admin pricing page (AC: #4)
  - [x] 5.1 Create `app/(admin)/admin/pricing/page.tsx` with Storm Mode section
  - [x] 5.2 Server Component page delegating to `StormModeToggle` client component

- [x] Task 6: Update admin sidebar navigation (AC: #4)
  - [x] 6.1 Add `{ href: "/admin/pricing", label: "Pricing", icon: TrendingUp }` to links array in `components/admin/sidebar.tsx`
  - [x] 6.2 Add same link to `components/admin/admin-mobile-nav.tsx`

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** Read `_bmad-output/project-context.md` before writing any code -- 127 rules are mandatory.

**The pricing engine already handles Storm Mode.** The `calculateBookingPrice()` function in `server/api/lib/pricing-engine.ts` already resolves by priority (highest wins). Storm Mode templates have priority 100, regular blocks have priority 1. When a Storm Mode template is set to `isActive: true`, it automatically overrides all regular pricing. You do NOT need to modify the pricing engine.

**Mutual exclusivity.** Only ONE Storm Mode template can be active at a time. The activate endpoint MUST deactivate ALL storm templates before activating the selected one. This prevents priority conflicts between multiple active storm templates.

**Storm Mode templates are identified by priority >= 100.** The 3 seeded Storm Mode templates (Ice Storm, Falcons Game, Holiday Weekend) all have `priority: 100`. Regular time-block configs have `priority: 1`. Use this to filter storm templates from regular configs.

**Integer math ONLY.** Multipliers in basis points (10000 = 1.0x). No floating-point financial operations.

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

**Seeded Storm Mode templates** (from `db/seed.ts`, created in Story 2.1):
- "Ice Storm" -- startHour: 0, endHour: 24, multiplier: 15000 (1.5x), isActive: false, priority: 100
- "Falcons Game" -- startHour: 0, endHour: 24, multiplier: 13000 (1.3x), isActive: false, priority: 100
- "Holiday Weekend" -- startHour: 0, endHour: 24, multiplier: 12000 (1.2x), isActive: false, priority: 100

**Existing pricing-config route** -- `server/api/routes/pricing-config.ts`:
- `GET /` -- Lists ALL time-block configs (storm + regular). Already exists.
- `PUT /:id` -- Updates any config (multiplier, isActive, etc.). Already exists with audit logging.
- Mounted at `/admin/pricing` in `server/api/index.ts`.
- Uses `requireAdmin` middleware on all routes.

**Pricing engine** -- `server/api/lib/pricing-engine.ts`:
```typescript
// Queries active configs, filters by hour match, sorts by priority DESC
// Highest priority wins -- Storm Mode (100) overrides Standard/After-Hours (1)
const matching = configs
  .filter((c) => { /* hour matching logic */ })
  .sort((a, b) => b.priority - a.priority);
const block = matching[0]; // highest priority active config
```
**No changes needed to pricing engine.** Storm Mode works by toggling `isActive` on template rows.

**WebSocket types** -- `server/websocket/types.ts`:
```typescript
export type WSEvent =
  | { type: "booking:created"; data: { ... } }
  | { type: "booking:status_changed"; data: { ... } }
  | { type: "provider:job_assigned"; data: { ... } }
  | { type: "provider:location_updated"; data: { ... } }
  | { type: "auth"; data: { ... } }
  | { type: "pong"; data: Record<string, never> };
```

**WebSocket broadcast** -- `server/websocket/connections.ts`:
- `broadcastToAdmins(event)` -- sends to all connected admin WebSocket clients
- All broadcast functions are fire-and-forget, imported from `server/websocket/broadcast.ts`

**Audit logger** -- `server/api/lib/audit-logger.ts`:
- `pricing.toggle_storm_mode` action already exists in AuditAction type
- Usage: `logAudit({ action, userId, resourceType, resourceId, details, ipAddress, userAgent })`
- Fire-and-forget (no await needed)

**Admin sidebar** -- `components/admin/sidebar.tsx`:
- Links array with `{ href, label, icon }` objects
- Icons from `lucide-react`
- Same structure in `components/admin/admin-mobile-nav.tsx`
- Currently NO Pricing link exists -- must be added

### Exact Implementation Specifications

**1. Constants (`lib/constants.ts`) -- append:**
```typescript
export const STORM_MODE_PRIORITY = 100; // Storm templates have priority >= this value
```

**2. Validator (`lib/validators.ts`) -- append:**
```typescript
export const activateStormModeSchema = z.object({
  templateId: z.string().min(1, "Template ID is required"),
});
export type ActivateStormModeInput = z.infer<typeof activateStormModeSchema>;
```

**3. WebSocket types (`server/websocket/types.ts`) -- add to union:**
```typescript
| { type: "storm_mode:activated"; data: { templateName: string; multiplier: number; activatedBy: string } }
| { type: "storm_mode:deactivated"; data: { deactivatedBy: string } }
```

**4. Storm Mode endpoints (add to `server/api/routes/pricing-config.ts`):**

These routes MUST be added BEFORE the existing `PUT /:id` route to prevent Hono matching "storm-mode" as an `:id` parameter.

```typescript
import { and, gte } from "drizzle-orm";
import { activateStormModeSchema } from "@/lib/validators";
import { STORM_MODE_PRIORITY } from "@/lib/constants";
import { broadcastToAdmins } from "@/server/websocket/broadcast";

// GET /storm-mode/status - Get current storm mode status
app.get("/storm-mode/status", async (c) => {
  const activeStorm = await db.query.timeBlockConfigs.findFirst({
    where: and(
      eq(timeBlockConfigs.isActive, true),
      gte(timeBlockConfigs.priority, STORM_MODE_PRIORITY),
    ),
  });
  return c.json({
    active: !!activeStorm,
    template: activeStorm || null,
  }, 200);
});

// POST /storm-mode/activate - Activate a storm mode template
app.post("/storm-mode/activate", async (c) => {
  const body = await c.req.json();
  const parsed = activateStormModeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const { templateId } = parsed.data;

  // Verify template exists and is a storm template (priority >= 100)
  const template = await db.query.timeBlockConfigs.findFirst({
    where: and(
      eq(timeBlockConfigs.id, templateId),
      gte(timeBlockConfigs.priority, STORM_MODE_PRIORITY),
    ),
  });
  if (!template) {
    return c.json({ error: "Storm mode template not found" }, 404);
  }

  // Deactivate ALL storm mode templates first (mutual exclusivity)
  await db
    .update(timeBlockConfigs)
    .set({ isActive: false, updatedAt: new Date() })
    .where(gte(timeBlockConfigs.priority, STORM_MODE_PRIORITY));

  // Activate selected template
  const [activated] = await db
    .update(timeBlockConfigs)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(timeBlockConfigs.id, templateId))
    .returning();

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  logAudit({
    action: "pricing.toggle_storm_mode",
    userId: user.id,
    resourceType: "time_block_config",
    resourceId: templateId,
    details: { action: "activate", templateName: template.name, multiplier: template.multiplier },
    ipAddress,
    userAgent,
  });

  broadcastToAdmins({
    type: "storm_mode:activated",
    data: { templateName: template.name, multiplier: template.multiplier, activatedBy: user.name || user.id },
  });

  return c.json(activated, 200);
});

// POST /storm-mode/deactivate - Deactivate all storm mode templates
app.post("/storm-mode/deactivate", async (c) => {
  // Deactivate ALL storm mode templates
  await db
    .update(timeBlockConfigs)
    .set({ isActive: false, updatedAt: new Date() })
    .where(gte(timeBlockConfigs.priority, STORM_MODE_PRIORITY));

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  logAudit({
    action: "pricing.toggle_storm_mode",
    userId: user.id,
    resourceType: "time_block_config",
    details: { action: "deactivate" },
    ipAddress,
    userAgent,
  });

  broadcastToAdmins({
    type: "storm_mode:deactivated",
    data: { deactivatedBy: user.name || user.id },
  });

  return c.json({ success: true }, 200);
});
```

**Critical: Route ordering.** In `pricing-config.ts`, the final file structure must be:
1. `app.use("/*", requireAdmin)` (existing)
2. `GET /` (existing -- list all configs)
3. `GET /storm-mode/status` (NEW)
4. `POST /storm-mode/activate` (NEW)
5. `POST /storm-mode/deactivate` (NEW)
6. `PUT /:id` (existing -- update any config)

**5. Storm Mode Toggle Component (`components/admin/storm-mode-toggle.tsx`):**

Client component with:
- Fetches `GET /api/admin/pricing/storm-mode/status` on mount
- Fetches `GET /api/admin/pricing` and filters templates where `priority >= 100`
- Displays template cards with: name, multiplier (formatted as percentage, e.g., "1.5x"), active indicator
- "Activate" button on inactive templates → `POST /api/admin/pricing/storm-mode/activate`
- "Deactivate" button when storm mode is active → `POST /api/admin/pricing/storm-mode/deactivate`
- Inline multiplier editing → `PUT /api/admin/pricing/:id` with `{ multiplier: newValue }`
- Use shadcn/ui components: `Card`, `Button`, `Badge`, `Input`
- Use `toast.success()` / `toast.error()` from sonner for feedback
- Format multiplier display: `(multiplier / 100).toFixed(0) + "%"` or `(multiplier / 10000).toFixed(2) + "x"`
- Use shadcn theme tokens for colors (`text-destructive` for active storm mode indicator, `bg-muted` for cards)

```tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { STORM_MODE_PRIORITY } from "@/lib/constants";

interface TimeBlockConfig {
  id: string;
  name: string;
  multiplier: number;
  isActive: boolean;
  priority: number;
}

export function StormModeToggle() {
  const [templates, setTemplates] = useState<TimeBlockConfig[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<TimeBlockConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMultiplier, setEditMultiplier] = useState("");
  // ... useEffect fetch, activate, deactivate, edit handlers
}
```

**6. Admin Pricing Page (`app/(admin)/admin/pricing/page.tsx`):**

```tsx
import { StormModeToggle } from "@/components/admin/storm-mode-toggle";

export default function PricingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Pricing Management</h1>
      <StormModeToggle />
    </div>
  );
}
```

**7. Sidebar updates:**

In both `components/admin/sidebar.tsx` and `components/admin/admin-mobile-nav.tsx`:
- Add `TrendingUp` to lucide-react imports
- Add to links array (insert after "Trust Tier"):
```typescript
{ href: "/admin/pricing", label: "Pricing", icon: TrendingUp },
```

### Project Structure Notes

**Files to CREATE:**

| File | Purpose |
|---|---|
| `components/admin/storm-mode-toggle.tsx` | Storm Mode template selection and toggle UI |
| `app/(admin)/admin/pricing/page.tsx` | Admin pricing management page |

**Files to MODIFY:**

| File | What to Change |
|---|---|
| `server/api/routes/pricing-config.ts` | Add 3 storm-mode endpoints (status, activate, deactivate). Add imports for `and`, `gte`, `activateStormModeSchema`, `STORM_MODE_PRIORITY`, `broadcastToAdmins`. Storm mode routes BEFORE `PUT /:id`. |
| `server/websocket/types.ts` | Add `storm_mode:activated` and `storm_mode:deactivated` to WSEvent union |
| `lib/validators.ts` | Add `activateStormModeSchema` |
| `lib/constants.ts` | Add `STORM_MODE_PRIORITY = 100` |
| `components/admin/sidebar.tsx` | Add Pricing nav link with `TrendingUp` icon |
| `components/admin/admin-mobile-nav.tsx` | Add Pricing nav link with `TrendingUp` icon |

**Files NOT to create:**
- NO `server/api/routes/storm-mode.ts` -- storm mode endpoints go in the EXISTING `pricing-config.ts` route module (it's the same resource domain)
- NO `server/api/lib/storm-mode.ts` -- the logic is simple enough to live in the route handler
- NO `db/schema/` changes -- Storm Mode templates already exist in `time_block_configs` table
- NO migration files -- no schema changes needed
- NO `components/admin/pricing-config-table.tsx` -- that's Story 2.3 scope
- NO test files

**Files NOT to modify:**
- NO changes to `server/api/lib/pricing-engine.ts` -- already handles priority resolution
- NO changes to `server/api/index.ts` -- pricing-config route already registered at `/admin/pricing`
- NO changes to `db/seed.ts` -- Storm Mode templates already seeded
- NO changes to `server/api/lib/audit-logger.ts` -- `pricing.toggle_storm_mode` already exists

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Create a separate route module for storm mode | Add endpoints to existing `pricing-config.ts` |
| Modify the pricing engine to "check for storm mode" | Pricing engine already handles this via priority resolution |
| Allow multiple storm templates to be active simultaneously | Deactivate ALL storm templates before activating one |
| Use `PATCH` for storm mode toggle | Use `POST /storm-mode/activate` and `POST /storm-mode/deactivate` (action endpoints) |
| Add storm mode routes AFTER `PUT /:id` | Register BEFORE `/:id` to prevent Hono matching "storm-mode" as an ID |
| Import from `"zod"` | Import from `"zod/v4"` |
| Use relative imports `../` | Use `@/` path alias |
| Forget `updatedAt: new Date()` in update calls | Always include it |
| Await WebSocket broadcasts | Fire-and-forget: `broadcastToAdmins(event)` (no await, no `.catch()`) |
| Await audit logging | Fire-and-forget: `logAudit({...})` (no await) |
| Use raw hex colors in component | Use shadcn theme tokens (`text-destructive`, `bg-muted`, etc.) |
| Create a default export for the component | Use named export: `export function StormModeToggle()` |
| Use string concatenation for CSS classes | Use `cn()` utility for conditional classes |
| Calculate multiplier as floating point | Basis points only: `(multiplier / 100)` for percentage display, `(multiplier / 10000)` for multiplier display |
| Create a complex state management solution | Simple `useState` + `useEffect` + `fetch` pattern |

### Previous Story Intelligence

**From Story 2.1 (Time-Block Pricing Schema & Engine):**
- Pricing-config route pattern: `new Hono<AuthEnv>()` with `requireAdmin` middleware. AuthEnv type declared locally in the route file.
- Audit logging: Fire-and-forget `logAudit()` with `getRequestInfo(c.req.raw)` for IP/UA.
- Import pattern: `import { logAudit, getRequestInfo } from "@/server/api/lib/audit-logger"`
- Validators imported from `@/lib/validators`.
- PUT endpoint includes no-op guard (`Object.keys(data).length === 0`).
- Code review caught: import ordering (type imports after regular), no-op guards needed.
- Emergency row seeded as `isActive: false` with `priority: 1` -- this is NOT a storm template. It covers all hours at regular priority. Storm templates have `priority: 100`.

**From Story 1.3 (Admin Trust Tier Configuration):**
- Admin table component pattern: `useState` + `useEffect` + `fetch` with loading/error states.
- Inline actions on table rows (promote/demote buttons).
- Use `toast.success()` and `toast.error()` from sonner for user feedback.
- shadcn components: `Card`, `Button`, `Badge`, `Table`, `Input`.

**From Story 1.4 (Customer Trust Tier Visibility):**
- Client component pattern: fetch from API in `useEffect`, display with loading states.
- Use shadcn theme tokens for colors (not hard-coded hex values).
- Division-by-zero guard with `Math.max(1, ...)` for any division operations.

**Key Patterns from All Previous Stories:**
- Every new Hono route needs `AuthEnv` type parameter declared locally
- Destructure `.returning()` -- it returns an array
- `updatedAt: new Date()` in every update call
- Fire-and-forget for notifications/broadcasts (no await, no catch)
- Named exports for components, default export for Hono route modules
- Validators added to `lib/validators.ts`, constants to `lib/constants.ts`

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
- The codebase has migrations 0000-0011 -- this story does NOT need a new migration
- Story 2.1 (f578855) created the pricing-config route and pricing engine that this story extends

### Dependencies and Scope

**This story depends on:** Story 2.1 (Time-Block Pricing Schema & Engine) -- DONE. Provides `time_block_configs` table, pricing engine, admin pricing-config route, and seeded Storm Mode templates.

**This story blocks:** Story 2.3 (Admin Pricing Configuration & Booking Override) -- needs the pricing page created here.

**This story does NOT include:**
- Time-block window configuration UI (Story 2.3 -- `pricing-config-table.tsx`)
- Individual booking price override (Story 2.3 -- `priceOverrideCents` column)
- Transparent pricing display to customers (Story 4.2)
- Time-block window hour/multiplier editing UI for Standard/After-Hours configs (Story 2.3)
- Provider push notification when Storm Mode activates (optional enhancement, not in FRs)

**Scope boundary:** Storm Mode activation/deactivation API + admin Storm Mode UI + WebSocket broadcast + sidebar navigation. The pricing page is created with Storm Mode section only; the full pricing configuration table will be added by Story 2.3.

### Testing Guidance

No test framework is installed. Do NOT create test files. Verify manually:

1. `GET /api/admin/pricing/storm-mode/status` -- returns `{ active: false, template: null }` by default
2. `POST /api/admin/pricing/storm-mode/activate` with valid template ID -- template becomes active, returns updated record
3. `GET /api/admin/pricing/storm-mode/status` -- now returns `{ active: true, template: { ... } }`
4. Create a booking at any time -- verify Storm Mode multiplier is applied (not time-block)
5. `POST /api/admin/pricing/storm-mode/deactivate` -- all storm templates become inactive
6. `GET /api/admin/pricing/storm-mode/status` -- returns `{ active: false, template: null }` again
7. Create a booking at 10 PM -- verify After-Hours multiplier applies again (Storm Mode off)
8. Activate one template, then activate a different one -- verify only the new one is active (mutual exclusivity)
9. `PUT /api/admin/pricing/:id` with updated multiplier on a storm template -- verify multiplier changes
10. Verify non-admin cannot access storm mode endpoints (403)
11. Check audit logs for `pricing.toggle_storm_mode` entries after activate/deactivate
12. Navigate to `/admin/pricing` -- verify page loads with Storm Mode section
13. Verify "Pricing" link appears in sidebar and mobile nav

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2, Story 2.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture - Time-Block Pricing]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns - WebSocket Events]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns - Notification Triggers]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns - Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure - Complete Directory Structure]
- [Source: _bmad-output/planning-artifacts/architecture.md#Anti-Patterns for New Features]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: server/api/routes/pricing-config.ts - Existing admin pricing route]
- [Source: server/api/lib/pricing-engine.ts - calculateBookingPrice with priority resolution]
- [Source: server/websocket/types.ts - WSEvent type union]
- [Source: server/websocket/connections.ts - broadcastToAdmins function]
- [Source: server/api/lib/audit-logger.ts - pricing.toggle_storm_mode action]
- [Source: db/schema/time-block-configs.ts - Storm Mode template schema]
- [Source: db/seed.ts - Seeded Storm Mode templates (Ice Storm, Falcons Game, Holiday Weekend)]
- [Source: components/admin/sidebar.tsx - Admin navigation links]
- [Source: components/admin/admin-mobile-nav.tsx - Mobile admin navigation]
- [Source: lib/constants.ts - DEFAULT_MULTIPLIER_BP, existing constants pattern]
- [Source: lib/validators.ts - Existing validator pattern]
- [Source: _bmad-output/implementation-artifacts/2-1-time-block-pricing-schema-and-engine.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None -- zero TypeScript errors, all edits applied cleanly.

### Completion Notes List

- All 6 tasks (14 subtasks) completed successfully
- TypeScript build passes with zero errors (`npx tsc --noEmit`)
- No pricing engine modifications needed -- existing priority resolution handles Storm Mode
- Storm mode routes registered BEFORE `PUT /:id` to prevent Hono parameter matching conflicts
- Mutual exclusivity enforced: activate deactivates ALL storm templates before activating selected one
- Fire-and-forget pattern used for WebSocket broadcasts and audit logging (no await)
- Integer basis-point math throughout (10000 = 1.0x)

### Code Review (2026-02-16)

**Reviewer:** Claude Opus 4.6 (adversarial review)
**Issues Found:** 0 Critical, 2 Medium, 4 Low
**All issues fixed automatically:**

- **M1 FIXED**: Wrapped storm mode activate deactivate-all + activate-one in `db.transaction()` to prevent race condition with concurrent admin operations (`pricing-config.ts`)
- **M2 FIXED**: Added try-catch error handling around all fetch calls in `StormModeToggle` to handle network failures gracefully (`storm-mode-toggle.tsx`)
- **L1 FIXED**: Clarified deactivate audit log details to `deactivate_all` for better audit trail (`pricing-config.ts`)
- **L2 FIXED**: Changed `activateStormModeSchema` templateId from `z.string().min(1)` to `z.string().uuid()` for consistency with other ID validators (`validators.ts`)
- **L3 FIXED**: Corrected multiplier validation error message from "0.0001x" to "0.01x" to match input constraints (`storm-mode-toggle.tsx`)
- **L4 SKIPPED**: Page title "Pricing" vs spec "Pricing Management" -- kept "Pricing" for consistency with other admin pages

### File List

**Created:**
- `components/admin/storm-mode-toggle.tsx` -- Storm Mode template selection and toggle UI (client component)
- `app/(admin)/admin/pricing/page.tsx` -- Admin pricing page (server component)

**Modified:**
- `lib/constants.ts` -- Added `STORM_MODE_PRIORITY = 100`
- `lib/validators.ts` -- Added `activateStormModeSchema` and type export
- `server/websocket/types.ts` -- Added `storm_mode:activated` and `storm_mode:deactivated` to WSEvent union
- `server/api/routes/pricing-config.ts` -- Added 3 storm-mode endpoints (status, activate, deactivate) with imports
- `components/admin/sidebar.tsx` -- Added Pricing nav link with TrendingUp icon
- `components/admin/admin-mobile-nav.tsx` -- Added Pricing nav link with TrendingUp icon

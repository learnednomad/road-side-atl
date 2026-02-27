# Story 4.1: Booking Mode Toggle (Immediate & Scheduled)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Epic: 4 - Enhanced Booking Experience -->
<!-- Story Key: 4-1-booking-mode-toggle -->
<!-- Created: 2026-02-17 -->
<!-- FRs: FR1 (emergency booking), FR2 (scheduled booking) -->
<!-- NFRs: NFR43 (44x44px touch targets), NFR5 (CLS < 0.1) -->
<!-- Dependencies: Epic 2 (pricing engine) - DONE -->

## Story

As a customer,
I want to choose between an immediate emergency booking and a scheduled appointment in the same booking flow,
so that I can get help now or plan a service for later.

## Acceptance Criteria

1. **Mode Toggle Visibility** - Given I am on the booking page, when I see the booking form, then I see a mode toggle with "Now" (immediate) and "Schedule" options, and touch targets are minimum 44x44px (NFR43).

2. **Immediate Mode Behavior** - Given I select "Now" mode, when I proceed with the booking, then `scheduledAt` is null in the booking record, and auto-dispatch begins immediately upon confirmation.

3. **Scheduled Mode Behavior** - Given I select "Schedule" mode, when I proceed with the booking, then a date/time picker appears for selecting appointment time, and `scheduledAt` is set to the chosen timestamp, and the booking is created but dispatch is deferred until the scheduled time.

4. **Toggle Transition** - Given I toggle between modes, when I switch from "Schedule" back to "Now", then the date/time picker disappears and the form resets to immediate mode, and no layout shift occurs (NFR5).

## Tasks / Subtasks

- [x] Task 1: Add booking mode toggle UI to booking form Step 1 (AC: #1, #4)
  - [x] 1.1 Add `bookingMode` state (`"immediate" | "scheduled"`, default `"immediate"`) to `booking-form.tsx`
  - [x] 1.2 Create a two-option toggle group at the top of Step 1 (Service selection step) using the existing button-group pattern from `payment-method-selector.tsx`
  - [x] 1.3 Labels: "Get Help Now" (immediate) and "Schedule for Later" (scheduled)
  - [x] 1.4 Ensure both buttons meet 44x44px minimum touch target (NFR43) — use `min-h-[44px] min-w-[44px]`
  - [x] 1.5 Smart default: default to "immediate" for `roadside` category, "immediate" for `diagnostics` category (let customer switch to scheduled)

- [x] Task 2: Restructure scheduling UX in booking form Step 3 (AC: #3, #4)
  - [x] 2.1 When `bookingMode === "immediate"`: hide the Schedule card entirely from Step 3 — show a single-line confirmation: "ASAP — a provider will be dispatched immediately"
  - [x] 2.2 When `bookingMode === "scheduled"`: show enhanced date/time picker with min constraint (at least 2 hours from now) and helpful copy: "Select your preferred date and time"
  - [x] 2.3 When toggling from "Schedule" back to "Now": clear `scheduledAt` state and remove layout shift (use `min-h` container or CSS animation — NFR5 CLS < 0.1)
  - [x] 2.4 Update step validation: if `bookingMode === "scheduled"`, require `scheduledAt` to be non-empty and in the future

- [x] Task 3: Update review step and confirmation displays (AC: #2, #3)
  - [x] 3.1 Update Review step (Step 4) to show mode explicitly: "Immediate Service" with dispatch messaging OR "Scheduled for [date/time]"
  - [x] 3.2 Update `app/(marketing)/book/confirmation/page.tsx`: replace "ASAP" label with "Immediate — dispatching now" and add dispatch status context for scheduled bookings

- [x] Task 4: Wire auto-dispatch for immediate bookings in API route (AC: #2)
  - [x] 4.1 In `server/api/routes/bookings.ts` POST handler, after successful booking creation: if `scheduledAt` is null AND `AUTO_DISPATCH_ENABLED === "true"`, call `autoDispatchBooking(booking.id)` fire-and-forget
  - [x] 4.2 If `scheduledAt` is non-null, do NOT dispatch — booking will be dispatched later (existing admin workflow or future story)
  - [x] 4.3 Import `autoDispatchBooking` from `server/api/lib/auto-dispatch`
  - [x] 4.4 Add `dispatchResult` to the API response (matches existing pattern in admin.ts status change handler)

- [x] Task 5: Add future-time validation to booking validator (AC: #3)
  - [x] 5.1 In `lib/validators.ts`, add `.refine()` to `createBookingSchema`: when `scheduledAt` is provided, it must be at least 2 hours in the future
  - [x] 5.2 Error message: "Scheduled time must be at least 2 hours from now"

- [x] Task 6: TypeScript compilation check (AC: all)
  - [x] 6.1 Run `npx tsc --noEmit` — zero errors required

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** Read `_bmad-output/project-context.md` before writing any code — 127 rules are mandatory.

**No schema change needed.** The existing `scheduledAt` column (nullable timestamp) on the bookings table already represents the booking mode: `null = immediate`, `non-null = scheduled`. Per architecture: "Booking Mode toggle — No schema change needed. Existing `scheduledAt` column (null = immediate, timestamp = scheduled). Feature is purely UI enhancement." Do NOT add a `bookingMode` column.

**No test framework installed.** Do NOT create test files.

**Integer math for money.** All money values in cents. Multipliers in basis points (10000 = 1.0x).

### Existing Code You MUST Understand

**Booking form architecture (`components/booking/booking-form.tsx` — 622 lines):**

This is a 4-step wizard with state management:
```
Step 1: Service Selection → Step 2: Location & Vehicle → Step 3: Contact & Schedule → Step 4: Review & Book
```

State definitions (lines 44-64):
```typescript
const [step, setStep] = useState(1);
const [selectedServiceId, setSelectedServiceId] = useState("");
const [scheduledAt, setScheduledAt] = useState(""); // empty string = immediate
const [notes, setNotes] = useState("");
const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
```

Current scheduling UI is a bare `datetime-local` input in Step 3 (lines 445-459):
```typescript
<Card>
  <CardHeader>
    <CardTitle>Schedule</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Leave blank for ASAP service, or pick a date and time.
    </p>
    <Input
      type="datetime-local"
      value={scheduledAt}
      onChange={(e) => setScheduledAt(e.target.value)}
    />
  </CardContent>
</Card>
```

How `scheduledAt` is sent to API (line 173):
```typescript
scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
```

Review step display (lines 536-543):
```typescript
{scheduledAt && (
  <p className="text-sm">
    <span className="text-muted-foreground">Scheduled:</span>{" "}
    {new Date(scheduledAt).toLocaleString()}
  </p>
)}
{!scheduledAt && (
  <p className="text-sm font-medium text-primary">ASAP Service</p>
)}
```

Step validation function (lines 88-123) — Step 3 currently only validates contact fields, NOT `scheduledAt`:
```typescript
if (step === 3) {
  if (!contactName || !contactPhone || !contactEmail) return false;
  return true;
}
```

**Booking API route (`server/api/routes/bookings.ts` — POST handler, lines 25-128):**

Key flow:
1. Validates with `createBookingSchema`
2. Calls `calculateBookingPrice(data.serviceId, data.scheduledAt ? new Date(data.scheduledAt) : null)` — pricing engine uses `scheduledAt` to determine time-block multiplier
3. Inserts booking with `scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null`
4. Calls `notifyBookingCreated()` and `broadcastToAdmins()` fire-and-forget
5. Returns booking with pricingBreakdown

**CRITICAL GAP:** `autoDispatchBooking()` is NEVER called from the POST handler. It exists in `server/api/lib/auto-dispatch.ts` but is only called from the admin status change handler (`admin.ts` line 368: `autoDispatchBooking(bookingId).catch(() => null)` when status changes to "confirmed"). Story 4.1 wires it for immediate bookings.

**Pricing engine (`server/api/lib/pricing-engine.ts`):**

```typescript
export async function calculateBookingPrice(
  serviceId: string,
  scheduledAt?: Date | null,
): Promise<{ basePrice: number; multiplier: number; blockName: string; finalPrice: number }>
```

Uses `scheduledAt ?? new Date()` to determine pricing hour. Already correctly handles both immediate (uses current time) and scheduled (uses future time) pricing. No changes needed to the pricing engine.

**Auto-dispatch (`server/api/lib/auto-dispatch.ts`):**

```typescript
export async function autoDispatchBooking(bookingId: string)
```

Feature-flagged via `AUTO_DISPATCH_ENABLED` env var. Has no `scheduledAt` awareness — dispatches immediately when called. The caller (Story 4.1 will add) must gate on `scheduledAt === null` before calling.

**Existing toggle patterns in the booking flow:**

1. **Payment method selector** (`components/booking/payment-method-selector.tsx` lines 68-83) — button-group with `cn()` conditional styling:
```typescript
<button
  type="button"
  onClick={() => onChange(method)}
  className={cn(
    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
    value === method
      ? "border-primary bg-primary/5 ring-1 ring-primary"
      : "border-border hover:border-muted-foreground/30 hover:bg-muted"
  )}
>
```

2. **Referral credit selector** (`components/booking/referral-credit-selector.tsx`) — uses shadcn `<Switch>` component.

3. **shadcn Tabs** (`components/ui/tabs.tsx`) — available but unused anywhere in the codebase. NOT recommended for the mode toggle because Tabs have tab panels that mount/unmount content, which is wrong for a toggle that persists across all 4 steps.

**USE the button-group pattern** from `payment-method-selector.tsx` for the booking mode toggle. It's the established pattern in the booking flow and renders as two styled buttons.

**Confirmation page (`app/(marketing)/book/confirmation/page.tsx` lines 107-112):**
```typescript
<div className="flex justify-between">
  <span className="text-muted-foreground">Schedule</span>
  <span>
    {booking.scheduledAt
      ? new Date(booking.scheduledAt).toLocaleString()
      : "ASAP"}
  </span>
</div>
```

**Booking Zod validator (`lib/validators.ts` lines 22-32):**
```typescript
export const createBookingSchema = z.object({
  serviceId: z.string().uuid("Invalid service"),
  vehicleInfo: vehicleInfoSchema,
  location: locationSchema,
  contactName: z.string().min(2, "Name is required"),
  contactPhone: z.string().min(10, "Phone number is required"),
  contactEmail: z.email("Valid email is required"),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  paymentMethod: z.enum(["cash", "cashapp", "zelle", "stripe"]).optional(),
});
```

No future-time validation exists. Story 4.1 adds a `.refine()` to enforce `scheduledAt` (when provided) must be at least 2 hours from now.

### Exact Implementation Specifications

**1. Booking mode state and toggle UI (`booking-form.tsx`):**

Add at top of component state:
```typescript
const [bookingMode, setBookingMode] = useState<"immediate" | "scheduled">("immediate");
```

Add mode toggle JSX at the TOP of Step 1, before service selection:
```typescript
<div className="flex gap-3">
  <button
    type="button"
    onClick={() => {
      setBookingMode("immediate");
      setScheduledAt(""); // clear scheduled time
    }}
    className={cn(
      "flex-1 rounded-lg border p-4 text-center font-medium transition-colors min-h-[44px]",
      bookingMode === "immediate"
        ? "border-primary bg-primary/5 ring-1 ring-primary"
        : "border-border hover:border-muted-foreground/30 hover:bg-muted"
    )}
  >
    Get Help Now
  </button>
  <button
    type="button"
    onClick={() => setBookingMode("scheduled")}
    className={cn(
      "flex-1 rounded-lg border p-4 text-center font-medium transition-colors min-h-[44px]",
      bookingMode === "scheduled"
        ? "border-primary bg-primary/5 ring-1 ring-primary"
        : "border-border hover:border-muted-foreground/30 hover:bg-muted"
    )}
  >
    Schedule for Later
  </button>
</div>
```

This reuses the exact button-group styling pattern from `payment-method-selector.tsx`.

**2. Step 3 scheduling conditional (`booking-form.tsx`):**

Replace the existing Schedule card (lines 445-459) with:
```typescript
{bookingMode === "immediate" ? (
  <Card>
    <CardContent className="py-4">
      <p className="text-sm font-medium text-primary">
        Immediate Service — a provider will be dispatched right away
      </p>
    </CardContent>
  </Card>
) : (
  <Card>
    <CardHeader>
      <CardTitle>Schedule Appointment</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select your preferred date and time (minimum 2 hours from now)
      </p>
      <Input
        type="datetime-local"
        value={scheduledAt}
        onChange={(e) => setScheduledAt(e.target.value)}
        min={new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16)}
        required
      />
      {scheduledAt && new Date(scheduledAt) <= new Date(Date.now() + 2 * 60 * 60 * 1000) && (
        <p className="text-sm text-destructive">Must be at least 2 hours from now</p>
      )}
    </CardContent>
  </Card>
)}
```

**3. Step validation update (`booking-form.tsx`):**

Update the step 3 validation:
```typescript
if (step === 3) {
  if (!contactName || !contactPhone || !contactEmail) return false;
  if (bookingMode === "scheduled" && !scheduledAt) return false;
  if (bookingMode === "scheduled" && scheduledAt && new Date(scheduledAt) <= new Date(Date.now() + 2 * 60 * 60 * 1000)) return false;
  return true;
}
```

**4. Review step update (`booking-form.tsx`):**

Replace the existing scheduling display (lines 536-543) with:
```typescript
<p className="text-sm">
  <span className="text-muted-foreground">Service Mode:</span>{" "}
  {bookingMode === "immediate"
    ? "Immediate — dispatching now"
    : `Scheduled for ${new Date(scheduledAt).toLocaleString()}`}
</p>
```

**5. Auto-dispatch wiring (`server/api/routes/bookings.ts`):**

After the booking insert and notifications (after the `broadcastToAdmins` call), add:
```typescript
// Auto-dispatch for immediate bookings (deferred for scheduled)
let dispatchResult = null;
if (!booking.scheduledAt && process.env.AUTO_DISPATCH_ENABLED === "true") {
  dispatchResult = await autoDispatchBooking(booking.id).catch(() => null);
}

return c.json({
  ...booking,
  pricingBreakdown: { ... },
  dispatchResult,
}, 201);
```

Add import at top of file:
```typescript
import { autoDispatchBooking } from "../lib/auto-dispatch";
```

**6. Validator refinement (`lib/validators.ts`):**

Update `createBookingSchema`:
```typescript
export const createBookingSchema = z.object({
  serviceId: z.string().uuid("Invalid service"),
  vehicleInfo: vehicleInfoSchema,
  location: locationSchema,
  contactName: z.string().min(2, "Name is required"),
  contactPhone: z.string().min(10, "Phone number is required"),
  contactEmail: z.email("Valid email is required"),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  paymentMethod: z.enum(["cash", "cashapp", "zelle", "stripe"]).optional(),
}).refine(
  (data) => !data.scheduledAt || new Date(data.scheduledAt) > new Date(Date.now() + 2 * 60 * 60 * 1000),
  { message: "Scheduled time must be at least 2 hours from now" }
);
```

**7. Confirmation page update (`app/(marketing)/book/confirmation/page.tsx`):**

Replace the Schedule display (lines 107-112) with:
```typescript
<div className="flex justify-between">
  <span className="text-muted-foreground">Service Mode</span>
  <span>
    {booking.scheduledAt
      ? new Date(booking.scheduledAt).toLocaleString()
      : "Immediate — dispatching now"}
  </span>
</div>
```

### Project Structure Notes

**Files to CREATE:**
None — all changes go into existing files.

**Files to MODIFY:**

| File | What to Change |
|---|---|
| `components/booking/booking-form.tsx` | Add `bookingMode` state, mode toggle UI at top of Step 1, conditional scheduling UI in Step 3, update step validation, update review display |
| `server/api/routes/bookings.ts` | Wire `autoDispatchBooking()` for immediate bookings after creation |
| `lib/validators.ts` | Add `.refine()` to `createBookingSchema` for future-time validation on `scheduledAt` |
| `app/(marketing)/book/confirmation/page.tsx` | Update "ASAP" label to "Immediate — dispatching now" |

**Files NOT to create:**
- NO `components/booking/booking-mode-toggle.tsx` — the toggle is simple enough to inline in `booking-form.tsx` (2 buttons)
- NO schema migration files — no DB changes for this story
- NO `lib/booking-mode.ts` — no abstraction needed for a 2-value toggle
- NO test files

**Files NOT to modify:**
- NO changes to `db/schema/bookings.ts` — `scheduledAt` nullable timestamp already serves as mode indicator
- NO changes to `server/api/lib/pricing-engine.ts` — already correctly uses `scheduledAt` for time-block pricing
- NO changes to `server/api/lib/auto-dispatch.ts` — function is correct as-is, gating is done by the caller
- NO changes to `db/seed.ts` — existing seed data is fine
- NO changes to `server/api/index.ts` — no new route modules

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Add a `bookingMode` enum column to bookings table | Use existing `scheduledAt` null/non-null convention — architecture says no schema change |
| Create a separate `BookingModeToggle` component file | Inline the 2-button toggle in `booking-form.tsx` — too simple for a component |
| Use shadcn Tabs for the mode toggle | Use the button-group pattern from `payment-method-selector.tsx` — Tabs have tab panels that are wrong for a toggle persisting across 4 steps |
| Dispatch scheduled bookings immediately | Gate `autoDispatchBooking()` on `!booking.scheduledAt` — deferred dispatch is out of scope |
| Validate `scheduledAt` only client-side | Add server-side `.refine()` in Zod schema — never trust client validation alone |
| Import from `"zod"` | Import from `"zod/v4"` |
| Await `autoDispatchBooking()` blocking the response | Use `.catch(() => null)` — fire-and-forget pattern with fallback |
| Add layout shifts when toggling modes | Use fixed `min-h` containers for the conditional areas — CLS < 0.1 (NFR5) |

### Previous Story Intelligence

**From Epic 3 Stories (completed):**
- Fire-and-forget pattern for notifications/dispatch: `.catch(() => {})` or `.catch(() => null)`
- `broadcastToAdmins()` and `logAudit()` are never awaited
- Route ordering matters: specific routes before parameterized `/:id` routes
- TypeScript compilation is the only verification method — `npx tsc --noEmit`
- `getRequestInfo(c.req.raw)` for audit logging pattern
- Always destructure `.returning()`: `const [result] = await db.insert(...).returning()`

**From Story 3.3 code review:**
- Transaction wrapping for race-prone operations
- Refund endpoint patterns for proper idempotency guards
- Conditional UI rendering based on payout type — same pattern applies for booking mode

### Git Intelligence

**Recent commits:**
```
bb129e3 Add manual payment confirmation receipt emails, SMS notifications, and payout gap fix
047d30c Add tiered commission configuration, service-level payout calculation, and admin commission UI
b12c101 Add storm mode activation, time-block pricing config UI, and booking price override
```

**Patterns observed:**
- Imperative present tense commit messages ("Add", "Fix")
- Features bundled in single commits
- Schema changes + API + UI in same commit when part of the same story

### Testing Guidance

No test framework installed. Do NOT create test files. Verify manually:

1. **TypeScript compilation**: `npx tsc --noEmit` passes with zero errors.
2. **Mode toggle renders**: Both "Get Help Now" and "Schedule for Later" buttons visible on Step 1, min 44x44px.
3. **Immediate mode flow**: Select "Get Help Now" → proceed through steps → Step 3 shows "Immediate Service" messaging → Review shows "Immediate — dispatching now" → Booking created with `scheduledAt: null`.
4. **Scheduled mode flow**: Select "Schedule for Later" → proceed → Step 3 shows datetime picker → set future time → Review shows scheduled time → Booking created with `scheduledAt: [timestamp]`.
5. **Toggle transition**: Switch from "Schedule" to "Now" → datetime picker disappears, `scheduledAt` clears, no layout jump.
6. **Step 3 validation**: In scheduled mode, cannot proceed without selecting a future time at least 2 hours out.
7. **Server-side validation**: API rejects `scheduledAt` in the past or less than 2 hours from now.
8. **Auto-dispatch**: Immediate bookings trigger `autoDispatchBooking` when `AUTO_DISPATCH_ENABLED=true`. Scheduled bookings do NOT trigger dispatch.
9. **Confirmation page**: Shows "Immediate — dispatching now" for ASAP bookings, shows scheduled time for scheduled bookings.
10. **Pricing**: Immediate bookings priced at current time-block. Scheduled bookings priced at the scheduled time's time-block.

### Dependencies and Scope

**This story depends on:**
- Epic 2 (Dynamic Pricing) — DONE. Pricing engine correctly uses `scheduledAt`.

**This story does NOT block:**
- Story 4.2 (Transparent Pricing Display) — can proceed in parallel.

**This story does NOT include:**
- Deferred dispatch scheduler (scheduled bookings are stored but dispatched manually by admin or in a future story)
- Admin UI filter for immediate vs scheduled bookings (future enhancement)
- Push notification for scheduled booking reminders (future enhancement)
- Service category auto-defaulting the mode (kept as "immediate" default for all — can be enhanced later)

**Scope boundary:** Add mode toggle UI to booking form, wire auto-dispatch for immediate bookings, add server-side future-time validation, update confirmation page labels.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4, Story 4.1]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: components/booking/booking-form.tsx - 622-line 4-step wizard]
- [Source: components/booking/payment-method-selector.tsx - button-group toggle pattern]
- [Source: server/api/routes/bookings.ts - POST handler, no dispatch wired]
- [Source: server/api/lib/auto-dispatch.ts - autoDispatchBooking function]
- [Source: server/api/lib/pricing-engine.ts - calculateBookingPrice uses scheduledAt]
- [Source: lib/validators.ts - createBookingSchema, no future-time validation]
- [Source: app/(marketing)/book/confirmation/page.tsx - "ASAP" label]
- [Source: db/schema/bookings.ts - scheduledAt nullable timestamp]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — all changes compiled successfully on first attempt.

### Completion Notes List

- Task 1: Added `bookingMode` state and two-button toggle group at top of Step 1 using the `payment-method-selector.tsx` button-group pattern. Both buttons have `min-h-[44px] min-w-[44px]` for NFR43 compliance. Switching to "Get Help Now" clears `scheduledAt`. Default is "immediate" for all categories.
- Task 2: Replaced bare `datetime-local` Schedule card in Step 3 with conditional rendering — immediate mode shows "Immediate Service — a provider will be dispatched right away", scheduled mode shows enhanced picker with 2-hour minimum constraint and inline validation error. Step 3 validation now requires valid future `scheduledAt` when in scheduled mode.
- Task 3: Updated Step 4 review to show "Service Mode: Immediate — dispatching now" or "Scheduled for [date/time]". Updated confirmation page to show "Immediate — dispatching now" instead of "ASAP".
- Task 4: Wired `autoDispatchBooking()` in bookings POST handler — only fires when `scheduledAt` is null AND `AUTO_DISPATCH_ENABLED=true`. Uses `.catch(() => null)` fire-and-forget pattern. Added `dispatchResult` to API response.
- Task 5: Added `.refine()` to `createBookingSchema` enforcing `scheduledAt` (when provided) must be >2 hours from now. Server-side validation complements client-side.
- Task 6: `npx tsc --noEmit` passes with zero errors.

### Senior Developer Review (AI)

**Review Date:** 2026-02-17
**Reviewer:** Claude Opus 4.6 (adversarial code review)
**Outcome:** Approved (3 MEDIUM fixed, 2 LOW accepted)

**Action Items:**
- [x] [MEDIUM] Fix `datetime-local` `min` attribute using UTC instead of local time (booking-form.tsx:506)
- [x] [MEDIUM] Add `path: ["scheduledAt"]` to `.refine()` validation error (validators.ts:33)
- [x] [MEDIUM] Surface server-side refine error details to user instead of generic "Invalid input" (booking-form.tsx:188)
- [ ] [LOW] Pre-selected service URL param skips Step 1 mode toggle — accepted, default immediate is safe
- [ ] [LOW] No `aria-pressed` on toggle buttons — consistent with existing patterns

### Change Log

- 2026-02-17: Implemented booking mode toggle (immediate/scheduled), conditional scheduling UX, auto-dispatch wiring, server-side future-time validation, and updated confirmation displays.
- 2026-02-17: Code review fixes — fixed UTC/local timezone mismatch on datetime-local min, added path to refine error, surfaced server validation details to user.

### File List

- `components/booking/booking-form.tsx` — Modified: added `bookingMode` state, mode toggle UI in Step 1, conditional scheduling in Step 3, step validation update, review display update
- `server/api/routes/bookings.ts` — Modified: imported `autoDispatchBooking`, wired auto-dispatch for immediate bookings, added `dispatchResult` to response
- `lib/validators.ts` — Modified: added `.refine()` to `createBookingSchema` for future-time validation
- `app/(marketing)/book/confirmation/page.tsx` — Modified: replaced "ASAP" label with "Immediate — dispatching now"

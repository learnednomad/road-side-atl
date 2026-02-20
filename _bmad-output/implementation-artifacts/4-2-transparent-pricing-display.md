# Story 4.2: Transparent Pricing Display

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Epic: 4 - Enhanced Booking Experience -->
<!-- Story Key: 4-2-transparent-pricing-display -->
<!-- Created: 2026-02-17 -->
<!-- FRs: FR9 (transparent pricing with time-block multipliers) -->
<!-- NFRs: NFR43 (44x44px touch targets) -->
<!-- Dependencies: Epic 2 (pricing engine, time-block configs, storm mode) - DONE; Story 4.1 (booking mode toggle) - DONE -->

## Story

As a customer,
I want to see the transparent price including any time-block multipliers before confirming my booking,
so that I know exactly what I'm paying with no surprises.

## Acceptance Criteria

1. **Time-Block Pricing Visibility** - Given I am booking an emergency roadside service at 10 PM, when the pricing loads, then I see the base price, "After-Hours" label, 1.25x multiplier, and the final calculated price.

2. **Storm Mode Pricing Visibility** - Given Storm Mode is active, when I view booking pricing, then I see the Storm Mode label and its multiplier applied instead of the time-block multiplier.

3. **Price Consistency with Server** - Given the pricing engine returns a price, when it is displayed to me, then the price is formatted using `formatPrice()` and matches the server-calculated amount exactly, and all price components (base, multiplier, final) are visible.

## Tasks / Subtasks

- [x] Task 1: Create public pricing estimate API endpoint (AC: #1, #2, #3)
  - [x] 1.1 Create `server/api/routes/pricing-estimate.ts` with a GET endpoint that accepts `serviceId` (required) and `scheduledAt` (optional ISO string) as query params
  - [x] 1.2 Call `calculateBookingPrice(serviceId, scheduledAt)` from `server/api/lib/pricing-engine.ts` — returns `{ basePrice, multiplier, blockName, finalPrice }`
  - [x] 1.3 Return JSON: `{ basePrice, multiplier, blockName, finalPrice }` (all existing fields from pricing engine)
  - [x] 1.4 Validate `serviceId` as UUID; validate `scheduledAt` as ISO datetime string if provided (use Zod)
  - [x] 1.5 Register the route in `server/api/index.ts` as `app.route("/pricing-estimate", pricingEstimateRoutes)`
  - [x] 1.6 This is a PUBLIC endpoint (no `requireAuth`) — guests can see pricing before booking

- [x] Task 2: Add pricing estimate fetch to booking form (AC: #1, #2, #3)
  - [x] 2.1 In `components/booking/booking-form.tsx`, add state: `pricingBreakdown: { basePrice: number; multiplier: number; blockName: string; finalPrice: number } | null`
  - [x] 2.2 Add a `useEffect` that fires when `selectedServiceId` or `scheduledAt` changes: fetch `/api/pricing-estimate?serviceId=...&scheduledAt=...`
  - [x] 2.3 For immediate mode (`bookingMode === "immediate"`), omit `scheduledAt` param (pricing engine defaults to `new Date()`)
  - [x] 2.4 For scheduled mode, pass the user-selected `scheduledAt` value
  - [x] 2.5 Replace the client-side `estimatedPrice` calculation (lines ~82-87) with server-fetched `pricingBreakdown.finalPrice` — but keep towing per-mile additive calculation client-side (it's already additive on server too)
  - [x] 2.6 Add `pricingLoading` state to show loading indicator during fetch

- [x] Task 3: Build transparent pricing breakdown display in Step 4 (AC: #1, #2, #3)
  - [x] 3.1 Replace the existing "Estimated Total" block in Step 4 review (`booking-form.tsx` lines ~630-638) with a detailed pricing breakdown card
  - [x] 3.2 Show: base price (formatted), time-block/storm label (e.g., "After-Hours", "Storm Mode"), multiplier formatted as "1.25x", and final price
  - [x] 3.3 When multiplier is `10000` (1.0x / "Standard"), show simplified display without multiplier line
  - [x] 3.4 When multiplier is NOT standard, show the label + multiplier prominently (e.g., colored badge for "After-Hours 1.25x" or "Storm Mode 2.5x")
  - [x] 3.5 For towing, continue showing "Base: $X + mileage" below the breakdown
  - [x] 3.6 All prices formatted via `formatPrice()` from `lib/utils.ts`

- [x] Task 4: TypeScript compilation check (AC: all)
  - [x] 4.1 Run `npx tsc --noEmit` — zero errors required

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** Read `_bmad-output/project-context.md` before writing any code — 127 rules are mandatory.

**No schema change needed.** The pricing engine (`server/api/lib/pricing-engine.ts`) and time-block config schema already exist and work correctly. Do NOT modify the pricing engine or time-block schema.

**No test framework installed.** Do NOT create test files.

**Integer math for money.** All money values in cents. Multipliers in basis points (10000 = 1.0x). Use `formatPrice()` from `lib/utils.ts` to display — `$${(cents / 100).toFixed(2)}`.

**Zod v4 import.** Always `import { z } from "zod/v4"` — NOT `"zod"`.

### Existing Code You MUST Understand

**Pricing engine (`server/api/lib/pricing-engine.ts`):**
```typescript
calculateBookingPrice(serviceId: string, scheduledAt?: Date | null)
  → { basePrice: number, multiplier: number, blockName: string, finalPrice: number }
```
- `basePrice` = service.basePrice (cents)
- `multiplier` = time-block multiplier (basis points, 10000 = 1.0x)
- `blockName` = matched block name (e.g., "Standard", "After-Hours", "Emergency", or storm template name)
- `finalPrice` = `Math.round((basePrice * multiplier) / 10000)` (cents)
- Storm mode = high-priority time-block entries (priority >= `STORM_MODE_PRIORITY = 100`)

**Current client-side price calculation is WRONG (the gap this story fixes):**
```typescript
// booking-form.tsx lines ~82-87
let estimatedPrice = selectedService?.basePrice || 0;
// ^^^ IGNORES time-block multiplier entirely!
```
This must be replaced with server-fetched pricing that includes the multiplier.

**Towing per-mile is ADDITIVE (not multiplied):**
Both server and client add towing miles AFTER the multiplied price. Keep client-side towing calculation for display purposes.

**Booking API already returns `pricingBreakdown` in POST response:**
```typescript
// server/api/routes/bookings.ts lines ~129-133
return c.json({ ...booking, pricingBreakdown: { basePrice, multiplier, blockName } }, 201);
```
The new GET endpoint provides the SAME data BEFORE the booking is created.

**Route registration pattern:**
```typescript
// server/api/index.ts
import pricingEstimateRoutes from "./routes/pricing-estimate";
app.route("/pricing-estimate", pricingEstimateRoutes);
```

**Constants (`lib/constants.ts`):**
- `DEFAULT_MULTIPLIER_BP = 10000` (1.0x)
- `STORM_MODE_PRIORITY = 100` (storm entries have priority >= this)
- `TOWING_BASE_MILES = 10`, `TOWING_PRICE_PER_MILE_CENTS = 600`

**Multiplier display formatting (existing pattern in `components/admin/pricing-config-table.tsx`):**
```typescript
function formatMultiplier(bp: number): string {
  return `${(bp / 10000).toFixed(2)}x`;
}
```
This helper is local to admin component — either import or duplicate for the booking form.

### Project Structure Notes

- New endpoint file: `server/api/routes/pricing-estimate.ts` — follows existing pattern
- Registration in: `server/api/index.ts` — add import + `app.route()`
- Primary UI changes: `components/booking/booking-form.tsx` — modify Step 4 pricing block + add fetch logic
- No new components needed — the pricing breakdown is inline in the review step

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2: Transparent Pricing Display]
- [Source: server/api/lib/pricing-engine.ts — calculateBookingPrice()]
- [Source: components/booking/booking-form.tsx — lines 82-87 (client price calc), lines 630-638 (price display)]
- [Source: server/api/index.ts — route registration]
- [Source: lib/constants.ts — DEFAULT_MULTIPLIER_BP, STORM_MODE_PRIORITY]
- [Source: lib/utils.ts — formatPrice()]
- [Source: _bmad-output/project-context.md — 127 mandatory rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- TypeScript compilation: zero errors on first pass

### Completion Notes List

- Created public `/api/pricing-estimate` GET endpoint with Zod validation (serviceId UUID, optional scheduledAt ISO datetime)
- Endpoint delegates to existing `calculateBookingPrice()` — no pricing logic duplication
- Replaced broken client-side price calculation (`selectedService.basePrice` only) with server-fetched pricing that includes time-block multipliers
- `useEffect` fetches pricing on `selectedServiceId`, `bookingMode`, or `scheduledAt` change
- Step 4 review now shows transparent breakdown: base price, time-block/storm badge with multiplier (e.g., "After-Hours 1.25x"), towing mileage (additive), and total
- Standard pricing (1.0x) shows simplified view — no multiplier line
- Non-standard pricing shows colored badge with block name and multiplier
- All prices formatted via `formatPrice()` for server consistency
- Loading state shown during pricing fetch

### Change Log

- 2026-02-17: Story 4.2 implementation — transparent pricing display with server-fetched breakdown
- 2026-02-17: Code review — 3 MEDIUM + 2 LOW findings fixed

### File List

- server/api/routes/pricing-estimate.ts (NEW)
- server/api/index.ts (MODIFIED — added pricing-estimate route registration)
- components/booking/booking-form.tsx (MODIFIED — pricing fetch + breakdown display)

## Senior Developer Review (AI)

**Review Date:** 2026-02-17
**Reviewer:** Claude Opus 4.6 (adversarial code review)
**Outcome:** Approve (after fixes)

### Findings Summary

| # | Severity | Description | Status |
|---|----------|-------------|--------|
| 1 | MEDIUM | Pricing endpoint returns 500 on non-existent service UUID — missing service existence check before calling pricing engine | FIXED |
| 2 | MEDIUM | Missing AbortController in pricing useEffect — race condition on rapid service/mode changes | FIXED |
| 3 | MEDIUM | No rate limiting on public pricing-estimate endpoint — 2 DB queries per call, abuse risk | FIXED |
| 4 | LOW | Redundant conditional checks in pricing breakdown JSX (same condition evaluated 3x) | FIXED |
| 5 | LOW | Empty separator div as standalone conditional — folded into parent block | FIXED |

### Fixes Applied

- **Finding 1+3**: Added `db.query.services.findFirst()` check with 404 response + applied `rateLimitStrict` middleware to pricing-estimate endpoint
- **Finding 2**: Added `AbortController` with cleanup return in useEffect; `AbortError` silenced in catch
- **Finding 4+5**: Consolidated 3 separate `pricingBreakdown.multiplier !== DEFAULT_MULTIPLIER_BP` conditionals into single fragment wrapper

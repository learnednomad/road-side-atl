# Story 4.3: Diagnostic Product Selection

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Epic: 4 - Enhanced Booking Experience -->
<!-- Story Key: 4-3-diagnostic-product-selection -->
<!-- Created: 2026-02-17 -->
<!-- FRs: FR8 (tiered diagnostic products), FR64 (book pre-purchase inspection), FR65 (select tiered inspection products) -->
<!-- NFRs: None specific -->
<!-- Dependencies: Story 4.2 (transparent pricing display) - DONE; Story 3.1 (tiered commission) - DONE -->

## Story

As a customer,
I want to select from tiered diagnostic products (Basic, Standard, Premium) with clear features and pricing,
so that I can choose the right inspection level for my vehicle purchase decision.

## Acceptance Criteria

1. **Diagnostic Service Records** - Given the services table contains diagnostic product records, when the seed data runs, then three diagnostic service records exist: "Basic Inspection", "Standard Inspection", "Premium Inspection", and each record has a base price (cents), description of included inspection items, and commission rate.

2. **Tiered Product Selection** - Given I am booking a pre-purchase vehicle inspection, when I reach the product selection step, then I see tiered options: Basic, Standard, Premium with clearly displayed features and pricing for each, and I can specify location, date, and time for the inspection.

3. **Pricing Display** - Given I select a diagnostic product tier, when I proceed to confirmation, then the selected tier's base price is shown with any applicable time-block multiplier, and the total price matches the server-calculated amount.

## Tasks / Subtasks

- [x] Task 1: Update seed data with three tiered diagnostic products (AC: #1)
  - [x] 1.1 In `db/seed.ts`, replace the single "Car Purchase Diagnostics" entry (lines 103-111) with three tiered services:
    - "Basic Inspection" — slug: `basic-inspection`, basePrice: 15000 ($150), category: `diagnostics`, commissionRate: 2000
    - "Standard Inspection" — slug: `standard-inspection`, basePrice: 25000 ($250), category: `diagnostics`, commissionRate: 2000
    - "Premium Inspection" — slug: `premium-inspection`, basePrice: 39900 ($399), category: `diagnostics`, commissionRate: 1800
  - [x] 1.2 Each entry must include a `description` field listing the specific inspection items included in that tier (see Dev Notes for descriptions)
  - [x] 1.3 Update the `.returning()` destructure on line 113 to account for additional services (variable names may change)

- [x] Task 2: Update fallback data in book page (AC: #2)
  - [x] 2.1 In `app/(marketing)/book/page.tsx`, update the fallback `allServices` array (lines 40-47) to replace the single diagnostics entry with the same three tiered products (matching seed data slugs, prices, and categories)

- [x] Task 3: Update service card icon mapping for new slugs (AC: #2)
  - [x] 3.1 In `components/marketing/service-card.tsx`, update the `iconMap` (lines 15-22) to map the three new slugs (`basic-inspection`, `standard-inspection`, `premium-inspection`) to appropriate icons — remove the old `car-purchase-diagnostics` mapping

- [x] Task 4: Enhance booking form Step 1 to group services by category with feature display (AC: #2)
  - [x] 4.1 In `components/booking/booking-form.tsx`, split Step 1 service grid into two visual sections: "Emergency Roadside" and "Pre-Purchase Inspection"
  - [x] 4.2 Filter services by `category === "roadside"` and `category === "diagnostics"` into separate groups
  - [x] 4.3 For diagnostics services, expand service buttons to show the description text (feature list) below the name and price
  - [x] 4.4 Keep existing service selection behavior — clicking any service sets `selectedServiceId`, no other changes needed

- [x] Task 5: Verify pricing integration works end-to-end (AC: #3)
  - [x] 5.1 Confirm that selecting any of the 3 diagnostic tiers triggers the pricing estimate fetch (Story 4.2's `useEffect` fires on `selectedServiceId` change)
  - [x] 5.2 Confirm Step 4 review shows the transparent pricing breakdown (base + multiplier if non-standard) for each diagnostic tier
  - [x] 5.3 This is a verification task — no code changes expected unless regression found

- [x] Task 6: TypeScript compilation check (AC: all)
  - [x] 6.1 Run `npx tsc --noEmit` — zero errors required

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** Read `_bmad-output/project-context.md` before writing any code — 127 rules are mandatory.

**No schema change needed.** The services table already has all required fields: `name`, `slug`, `description`, `basePrice`, `category` (with "diagnostics" enum value), `commissionRate`. This story only modifies data, not schema.

**No test framework installed.** Do NOT create test files.

**Integer math for money.** All money values in cents. Commission rates in basis points (10000 = 100%, 2000 = 20%).

**Zod v4 import.** Always `import { z } from "zod/v4"` — NOT `"zod"`.

### Tiered Product Descriptions

**Basic Inspection** ($150):
> "Essential pre-purchase check covering OBD2 scan, visual exterior/interior inspection, fluid levels, tire condition, and battery health."

**Standard Inspection** ($250):
> "Comprehensive inspection including OBD2 diagnostics, brake system check, suspension test, electrical system review, engine performance analysis, and photo documentation."

**Premium Inspection** ($399):
> "Complete diagnostic report with full mechanical inspection, detailed OBD2 code analysis, test drive evaluation, undercarriage examination, emissions check, and branded PDF report with repair cost estimates."

### Existing Code You MUST Understand

**Seed data structure (`db/seed.ts` lines 62-113):**
```typescript
const [...serviceVars] = await db
  .insert(services)
  .values([
    { name: "Jump Start", slug: "jump-start", ... category: "roadside" },
    { name: "Towing (Local)", slug: "towing", ... category: "roadside" },
    // ... 3 more roadside services
    { name: "Car Purchase Diagnostics", slug: "car-purchase-diagnostics", ... category: "diagnostics" },
  ])
  .returning();
```
Replace the single diagnostics entry with 3 tiered entries. The destructure after `.returning()` must account for the new count.

**Book page fallback (`app/(marketing)/book/page.tsx` lines 40-47):**
```typescript
allServices = [
  { id: "1", name: "Jump Start", ... category: "roadside" },
  // ... 4 more roadside
  { id: "6", name: "Car Purchase Diagnostics", ... category: "diagnostics" },
];
```
Replace single diagnostics with 3 tiered entries, incrementing IDs.

**Service card icon map (`components/marketing/service-card.tsx` lines 15-22):**
```typescript
const iconMap: Record<string, React.ElementType> = {
  "car-purchase-diagnostics": Wrench,
  // ...
};
```
Remove old slug, add 3 new slugs. Use `Wrench` for all 3 (or differentiate if desired).

**Booking form Step 1 (`components/booking/booking-form.tsx` lines 328-361):**
Currently renders ALL services in a single 2-column grid. AC #2 requires "tiered options" — split into roadside and diagnostics sections with category headers.

**Diagnostics "Payment upfront" badge (line 349-351):**
```typescript
{s.category === "diagnostics" && (
  <span className="mt-1 text-xs text-muted-foreground">Payment upfront</span>
)}
```
Already exists and will automatically apply to all 3 new diagnostic tiers.

**Pricing integration (Story 4.2 — already done):**
- `useEffect` at lines 90-109 fetches `/api/pricing-estimate?serviceId=...` on `selectedServiceId` change
- Step 4 shows transparent breakdown: base price, multiplier badge, total
- Works for ANY service — no changes needed for diagnostics pricing

### Previous Story Learnings (Story 4.2)

- AbortController added to pricing fetch useEffect (code review finding)
- Rate limiting added to pricing-estimate endpoint
- Service existence check added before calling pricing engine
- `pricingBreakdown` state uses server data, client-side towing additive stays separate
- `DEFAULT_MULTIPLIER_BP` imported for conditional display logic

### Project Structure Notes

- Seed data changes: `db/seed.ts` — data only, no schema
- Fallback data: `app/(marketing)/book/page.tsx` — update static array
- Icon mapping: `components/marketing/service-card.tsx` — update slug map
- Booking form: `components/booking/booking-form.tsx` — split Step 1 into category sections
- No new files needed

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3: Diagnostic Product Selection]
- [Source: db/seed.ts — lines 103-113 (current single diagnostic entry)]
- [Source: db/schema/services.ts — services table structure]
- [Source: app/(marketing)/book/page.tsx — lines 40-47 (fallback data)]
- [Source: components/marketing/service-card.tsx — lines 15-22 (icon map)]
- [Source: components/booking/booking-form.tsx — lines 328-361 (Step 1 service grid)]
- [Source: _bmad-output/project-context.md — 127 mandatory rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- TypeScript compilation: zero errors on first pass

### Completion Notes List

- Replaced single "Car Purchase Diagnostics" ($250) seed entry with three tiered diagnostic products: Basic ($150), Standard ($250), Premium ($399)
- Each tier includes descriptive text listing specific inspection items included
- Updated `.returning()` destructure to `[svcJump, svcTow, svcLockout, svcTire, svcFuel, svcDiagBasic, svcDiagStandard, svcDiagPremium]`
- Updated two booking seed references from `svcDiag` to `svcDiagStandard` (same $250 price, no pricing changes)
- Updated fallback data in book page with three diagnostic entries (IDs 6, 7, 8)
- Replaced old `car-purchase-diagnostics` icon mapping with three new slug mappings (all use `Wrench`)
- Split booking form Step 1 into two category sections: "Emergency Roadside" and "Pre-Purchase Inspection"
- Diagnostics section shows full description text below name/price for informed tier selection
- Added `description` as optional field to Service interface in booking form
- "Payment upfront" badge preserved for all diagnostic tiers
- Pricing integration verified: Story 4.2's useEffect + pricing breakdown work for all three tiers with no changes needed
- No schema changes — only data and UI modifications

### Change Log

- 2026-02-17: Story 4.3 implementation — tiered diagnostic product selection
- 2026-02-17: Code review — 2 MEDIUM + 1 LOW findings fixed

### File List

- db/seed.ts (MODIFIED — replaced single diagnostics entry with 3 tiered products)
- app/(marketing)/book/page.tsx (MODIFIED — updated fallback data with 3 diagnostic entries + descriptions)
- components/marketing/service-card.tsx (MODIFIED — updated icon mapping for new slugs)
- components/booking/booking-form.tsx (MODIFIED — split Step 1 into category sections with feature display)
- app/sitemap.ts (MODIFIED — replaced stale car-purchase-diagnostics slug with 3 tiered slugs)
- app/(marketing)/services/page.tsx (MODIFIED — updated fallback data with 3 tiered diagnostic products)
- app/(marketing)/page.tsx (MODIFIED — updated fallback data with 3 tiered diagnostic products)

## Senior Developer Review (AI)

**Review Date:** 2026-02-17
**Reviewer:** Claude Opus 4.6 (adversarial code review)
**Outcome:** Approve (after fixes)

### Findings Summary

| # | Severity | Description | Status |
|---|----------|-------------|--------|
| 1 | MEDIUM | Incomplete slug migration — old `car-purchase-diagnostics` still in sitemap.ts (hardcoded), services/page.tsx (fallback), page.tsx (fallback) | FIXED |
| 2 | MEDIUM | Fallback data in book/page.tsx missing `description` field for diagnostic entries — no feature text in DB-down mode | FIXED |
| 3 | LOW | Pre-existing `allServices: any[]` type bypasses Service interface type checking | NOTED (pre-existing) |

### Fixes Applied

- **Finding 1**: Replaced `car-purchase-diagnostics` with 3 tiered slugs in sitemap.ts; updated fallback arrays in services/page.tsx and page.tsx with 3 tiered diagnostic products matching seed data
- **Finding 2**: Added `description` fields to all 3 diagnostic fallback entries in book/page.tsx
- **Finding 3**: Not fixed — pre-existing tech debt, not introduced by this story

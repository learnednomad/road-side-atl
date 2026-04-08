# Story 17.4: Web Mechanic Booking UI

Status: backlog

## Story

As a customer using the web platform,
I want the booking form to visually distinguish mechanic services as scheduled-only and enforce a date/time picker when I select one,
so that I understand the booking is for a future appointment and cannot accidentally request immediate dispatch.

## Acceptance Criteria

1. **Scheduled Service badge** - Given the service list is rendered in the booking form, when a service has `schedulingMode === "scheduled"`, then a "Scheduled Service" badge is displayed next to the service name.

2. **ASAP toggle hidden** - Given a customer selects a service with `schedulingMode === "scheduled"`, when the booking form renders step 3 (Contact & Schedule), then the immediate/scheduled toggle is hidden and the mode is locked to `"scheduled"`.

3. **Date picker required** - Given a mechanic service is selected (schedulingMode = scheduled), when the customer reaches the schedule step, then the date/time picker is visible and required (cannot proceed without a date).

4. **Non-mechanic services unchanged** - Given a customer selects a service with `schedulingMode === "both"` or `schedulingMode === "immediate"`, when the booking form renders, then the immediate/scheduled toggle is visible and both modes are available (existing behavior).

5. **Review step reflects scheduled** - Given a mechanic service is selected with a valid scheduledAt, when the customer reaches the review step, then the summary shows "Scheduled for [date]" (never "ASAP").

6. **Pre-selection via query param** - Given the URL contains `?service=oil-change`, when the booking form loads, then the oil-change service is pre-selected, the mode is locked to scheduled, and the ASAP toggle is hidden.

## Tasks / Subtasks

- [ ] Task 1: Extend Service interface (AC: #1, #2)
  - [ ] 1.1 Add `schedulingMode?: string` to the `Service` interface in `components/booking/booking-form.tsx`
  - [ ] 1.2 Ensure the `/api/services` response includes `schedulingMode` (depends on Epic 16 FR-1.6)

- [ ] Task 2: Add Scheduled Service badge (AC: #1)
  - [ ] 2.1 In the service selection step, render a badge (e.g., `<span className="...">Scheduled Service</span>`) next to services where `schedulingMode === "scheduled"`
  - [ ] 2.2 Style the badge to differentiate from immediate services (use existing UI component patterns)

- [ ] Task 3: Lock booking mode for mechanic services (AC: #2, #3, #4)
  - [ ] 3.1 Add a `useEffect` that watches `selectedServiceId` -- when a service with `schedulingMode === "scheduled"` is selected, force `setBookingMode("scheduled")`
  - [ ] 3.2 In step 3, conditionally hide the immediate/scheduled toggle when the selected service has `schedulingMode === "scheduled"`
  - [ ] 3.3 When toggle is hidden, ensure the date/time picker is always visible and required
  - [ ] 3.4 Add validation in the step 3 "Next" handler: if `bookingMode === "scheduled"` and `!scheduledAt`, show error

- [ ] Task 4: Review step display (AC: #5)
  - [ ] 4.1 Verify the existing review step already shows "Scheduled for [date]" vs "ASAP" based on `bookingMode` -- no changes expected if step 3 correctly locks the mode

- [ ] Task 5: Query param pre-selection (AC: #6)
  - [ ] 5.1 Verify existing `preselectedSlug` logic works with mechanic service slugs
  - [ ] 5.2 When pre-selected service has `schedulingMode === "scheduled"`, ensure `useEffect` from Task 3 fires and locks the mode

## Dev Notes

### Critical Architecture Constraints

**Client component.** `booking-form.tsx` is a `"use client"` component. All state is managed with `useState`/`useEffect`.

**No new components needed.** The booking form is a single multi-step component. The changes are state logic and conditional rendering within the existing file.

**Prices in cents.** The `basePrice` field on services is in cents. The existing `formatPrice()` utility handles display.

### Existing Code You MUST Understand

**Service interface** -- `components/booking/booking-form.tsx` (lines 18-26):
```typescript
interface Service {
  id: string;
  name: string;
  slug: string;
  description?: string;
  basePrice: number;
  pricePerMile: number | null;
  category: string;
}
```
Add `schedulingMode?: string` to this interface. The field comes from the API response (Epic 16 adds it to the services table).

**Booking mode state** -- `components/booking/booking-form.tsx` (line 54):
```typescript
const [bookingMode, setBookingMode] = useState<"immediate" | "scheduled">("immediate");
```
This controls whether the user sees the ASAP or scheduled flow. For mechanic services, force this to `"scheduled"` and hide the toggle.

**Pre-selection from query params** -- `components/booking/booking-form.tsx` (lines 37-38):
```typescript
const searchParams = useSearchParams();
const preselectedSlug = searchParams.get("service");
```
This already handles `?service=oil-change`. The service gets pre-selected. Add logic to also read `vehicleYear`, `vehicleMake`, `vehicleModel` params for the upsell flow (Story 17.3 deep links).

**Step 3 mode toggle** -- `components/booking/booking-form.tsx` (lines 359-380):
```typescript
aria-checked={bookingMode === "immediate"}
// ...
bookingMode === "immediate"
// ...
aria-checked={bookingMode === "scheduled"}
// ...
bookingMode === "scheduled"
```
This is the immediate/scheduled toggle UI. Wrap it in a conditional: only render when `selectedService?.schedulingMode !== "scheduled"`.

**Step 3 validation** -- `components/booking/booking-form.tsx` (lines 198-201):
```typescript
if (bookingMode === "scheduled" && !scheduledAt) {
  // error state
}
if (bookingMode === "scheduled" && scheduledAt && new Date(scheduledAt) <= new Date(Date.now() + 2 * 60 * 60 * 1000)) {
  // error state
}
```
This validation already exists. It will apply correctly when `bookingMode` is locked to `"scheduled"`.

**Review step display** -- `components/booking/booking-form.tsx` (lines 745-747):
```typescript
{bookingMode === "immediate"
  ? `Scheduled for ${new Date(scheduledAt).toLocaleString()}`}
```
This already differentiates ASAP vs scheduled display. No changes needed if `bookingMode` is correctly locked.

### Implementation Pattern -- useEffect for mode locking

```typescript
// Derive the selected service object
const selectedService = services.find((s) => s.id === selectedServiceId);

// Lock booking mode for scheduled-only services
useEffect(() => {
  if (selectedService?.schedulingMode === "scheduled") {
    setBookingMode("scheduled");
  }
}, [selectedService?.schedulingMode]);
```

### Implementation Pattern -- conditional toggle rendering

```typescript
{/* Only show mode toggle for services that support both modes */}
{selectedService?.schedulingMode !== "scheduled" && (
  <div className="...">
    {/* existing immediate/scheduled toggle */}
  </div>
)}
```

### Implementation Pattern -- Scheduled Service badge

```typescript
{service.schedulingMode === "scheduled" && (
  <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
    Scheduled Service
  </span>
)}
```

### Project Structure Notes

**Files to MODIFY:**

| File | What to Change |
|---|---|
| `components/booking/booking-form.tsx` | Add `schedulingMode` to Service interface, add mode-locking useEffect, conditionally hide toggle, add badge |

**Files NOT to create:**
- NO new component files -- all changes are within the existing booking form
- NO new API routes -- the form consumes existing `/api/services` response
- NO new styles -- use existing Tailwind utility classes

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Create a separate MechanicBookingForm component | Modify the existing BookingForm with conditional logic |
| Hardcode mechanic service IDs | Check `service.schedulingMode === "scheduled"` |
| Remove the immediate/scheduled toggle entirely | Conditionally hide it only for scheduled-only services |
| Add server-side rendering logic | This is a client component; all logic is client-side |
| Forget to handle the query param upsell case | Read `vehicleYear`, `vehicleMake`, `vehicleModel` from URL params |

### Dependencies and Scope

**This story depends on:** Story 17.1 (backend validation), Epic 16 (services API returns `schedulingMode`)

**This story does NOT include:**
- Mobile booking UI (Epic 18/19 -- mobile app parity)
- Admin-side mechanic service management
- Category tab filtering on the service selection step (that is Epic 16 FR-1.5)

### Testing Guidance

Verify manually:
1. Load booking form -- select "Oil Change" (mechanic, `schedulingMode = "scheduled"`) -- ASAP toggle should be hidden, date picker should be required
2. Select a roadside service (e.g., "Jump Start", `schedulingMode = "both"`) -- ASAP toggle should appear, both modes available
3. With mechanic service selected, try to proceed without date -- should show validation error
4. With mechanic service selected and valid future date -- booking succeeds
5. Navigate to `/book?service=oil-change` -- Oil Change pre-selected, mode locked to scheduled
6. Navigate to `/book?service=oil-change&vehicleYear=2020&vehicleMake=Toyota&vehicleModel=Camry` -- service pre-selected, vehicle info pre-filled
7. Review step shows "Scheduled for [date]" (never "ASAP") for mechanic bookings

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 17, Story 17.4]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-6.2, Journey 1]
- [Source: components/booking/booking-form.tsx - Existing booking form with mode toggle and query param pre-selection]

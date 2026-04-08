# Story 19.2: Mechanic Booking Flow (Mobile)

Status: backlog

## Story

As a customer booking a mechanic service on the mobile app,
I want the booking flow to enforce a date/time picker and hide the ASAP option,
so that I can schedule an on-site mechanic appointment at a time that works for me.

## Acceptance Criteria

1. **Date Picker Required for Mechanics** - Given the user selects a mechanic service (e.g., Oil Change), when they reach the booking form, then a date/time picker is displayed and the user cannot proceed without selecting a date.

2. **No ASAP for Scheduled Services** - Given the selected service has `schedulingMode = 'scheduled'`, when the booking form renders, then no "ASAP" or "Now" option is available; only the date/time picker is shown.

3. **Location Label Updated** - Given a mechanic service is selected, when the location step renders, then the address label reads "Where should the mechanic come?" instead of the default "Address".

4. **scheduledAt Sent in Request** - Given the user completes the booking form with a mechanic service, when the booking is submitted, then the `scheduledAt` ISO string is included in the `POST /api/bookings` payload.

5. **Validation Error Handled** - Given the user somehow attempts to submit a mechanic booking without `scheduledAt`, when the API returns 400, then a user-friendly error message is displayed: "Mechanic services require a scheduled date."

6. **Existing Flows Unaffected** - Given the user selects a roadside or diagnostics service, when the booking form renders, then the flow remains unchanged (no mandatory date picker, ASAP behavior preserved).

## Tasks / Subtasks

- [ ] Task 1: Add date/time picker component (AC: #1, #2)
  - [ ] 1.1 Install `@react-native-community/datetimepicker` if not already present
  - [ ] 1.2 Create a reusable `DateTimePicker` wrapper component in `src/components/ui/` or inline in book-screen
  - [ ] 1.3 Picker should show date selection followed by time selection, combining into a single ISO string

- [ ] Task 2: Update booking flow for mechanic services (AC: #1, #2, #3)
  - [ ] 2.1 In `src/features/bookings/book-screen.tsx`, detect if selected service has `schedulingMode === 'scheduled'`
  - [ ] 2.2 Add a new step or inline section for date/time selection that appears for scheduled services
  - [ ] 2.3 Store `scheduledAt` in local state (new `useState<string>('')`)
  - [ ] 2.4 Update address label to "Where should the mechanic come?" when service is mechanic category
  - [ ] 2.5 Add mechanics section to Step 1 service selection (currently only renders `roadside` and `diagnostics` arrays)

- [ ] Task 3: Update booking submission (AC: #4, #5)
  - [ ] 3.1 Include `scheduledAt` in the `useCreateBooking` mutation payload when set
  - [ ] 3.2 The `CreateBookingVariables` type in `src/features/bookings/api.ts` already has optional `scheduledAt?: string` — ensure it is passed through
  - [ ] 3.3 Handle 400 validation error for missing `scheduledAt` with a descriptive alert

- [ ] Task 4: Review step shows scheduled date (AC: #1)
  - [ ] 4.1 Add a `ReviewRow` for "Scheduled Date" in step 4 when `scheduledAt` is set, formatted in user-friendly format (e.g., "Sat, Apr 12, 2026 at 10:00 AM")

- [ ] Task 5: Guard existing flows (AC: #6)
  - [ ] 5.1 Ensure date picker only renders when `schedulingMode === 'scheduled'` or `schedulingMode === 'both'` (for `'both'`, make it optional)
  - [ ] 5.2 Verify roadside and diagnostics booking paths remain unchanged

## Dev Notes

### Target Repo

**This is a MOBILE APP story.** All work is in `~/WebstormProjects/roadside-atl-mobile`.

### Existing Code Context

**Book screen** (`src/features/bookings/book-screen.tsx`):
4-step wizard: (1) Service Selection, (2) Location & Vehicle, (3) Contact Info, (4) Review & Book. Currently only renders `roadside` and `diagnostics` service lists in step 1. The `handleSubmit` function constructs the booking payload but does not include `scheduledAt`. The `CreateBookingVariables` type in `api.ts` already has an optional `scheduledAt?: string` field.

**Services data flow:**
- `useServices()` fetches from `GET /api/services` and returns `Service[]`
- Services are filtered client-side by category in book-screen
- After Story 19.1, the `Service` type will include `schedulingMode`

**Pricing estimate:**
`usePricingEstimate` already accepts optional `scheduledAt` for surge pricing calculation. Pass the selected date through.

### Key Implementation Details

- The `Service` type must include `schedulingMode` (added in Story 19.1). This story depends on 19.1.
- Use `@react-native-community/datetimepicker` for native date/time picker. The picker should enforce minimum date of tomorrow (no same-day mechanic bookings).
- The `scheduledAt` field in `CreateBookingVariables` already exists in `src/features/bookings/api.ts` — just pass it through from state.
- Mechanic services in Step 1 need a new section header: "Mobile Mechanics" with the filtered mechanic services listed below.

### Mobile Conventions

- **Routing:** Expo Router file-based routing at `src/app/`
- **State:** React Query for server state, Zustand for local state
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **API hooks:** `react-query-kit` with `createQuery` / `createMutation`
- **Stack:** Expo SDK 54, React Native 0.81.5, TypeScript

### Dependencies

- Story 19.1 (Service type must include `schedulingMode` and `mechanics` category)
- Epic 16, Story 16.1 (backend mechanic services seeded)
- Epic 17, Story 17.1 (backend `scheduledAt` enforcement for mechanic bookings)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 19, Story 19.2]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-6.2]
- [Source: roadside-atl-mobile/src/features/bookings/book-screen.tsx]
- [Source: roadside-atl-mobile/src/features/bookings/api.ts]

# Story 19.5: Reviews End-to-End Verification (Mobile)

Status: in-progress

> **~85% pre-existing.** `review-screen.tsx` has full star rating + comment submission. `api.ts` has `useBookingReview` and `useSubmitReview`. Core flow works end-to-end.
> **Remaining:** Push notification tap → navigate to `/review?bookingId=<id>` (depends on Story 18.3 push tap handler).

## Story

As a customer who has completed a booking,
I want to submit a star rating and comment from the mobile app,
so that I can share my experience and help other customers choose providers.

## Acceptance Criteria

1. **Review Prompt After Completion** - Given a booking transitions to `completed` status, when the customer views the booking detail screen, then a "Leave a Review" button is prominently displayed.

2. **Review Screen Loads** - Given the customer taps "Leave a Review", when the review screen opens, then it displays a star rating selector (1-5 stars) and an optional comment text field.

3. **Star Rating Works** - Given the review screen is visible, when the customer taps a star, then all stars up to and including the tapped star are filled, and the rating state updates correctly.

4. **Review Submits Successfully** - Given the customer selects a rating and optionally enters a comment, when they tap "Submit Review", then a `POST /api/bookings/:bookingId/review` request is sent with `{ rating, comment }` and a success confirmation is shown.

5. **Duplicate Review Prevented** - Given the customer has already submitted a review for a booking, when the booking detail screen renders, then the "Leave a Review" button is replaced with the submitted review (stars + comment), and the review screen is not accessible.

6. **Navigation Correct** - Given the review screen is accessed via `/review?bookingId=<id>`, when the `bookingId` param is present, then the screen uses it to submit the review to the correct booking endpoint.

7. **Error Handling** - Given the review submission fails (network error, server error), when the error occurs, then a user-friendly error alert is displayed and the user can retry.

## Tasks / Subtasks

- [ ] Task 1: Verify existing review screen (AC: #2, #3, #6)
  - [ ] 1.1 Confirm `src/features/bookings/review-screen.tsx` renders correctly with current dependencies
  - [ ] 1.2 Verify `useLocalSearchParams<{ bookingId: string }>()` correctly receives the bookingId
  - [ ] 1.3 Confirm star rating component (`StarRating`) works with accessibility labels
  - [ ] 1.4 Test that `useSubmitReview` mutation calls `POST /api/bookings/:bookingId/review`

- [ ] Task 2: Verify review API hooks (AC: #4, #5)
  - [ ] 2.1 Confirm `useSubmitReview` in `src/features/bookings/api.ts` sends correct payload `{ rating, comment }`
  - [ ] 2.2 Confirm `useBookingReview` query hook fetches existing review via `GET /api/bookings/:bookingId/review`
  - [ ] 2.3 Verify 404 response (no review yet) returns `null` correctly

- [ ] Task 3: Add review prompt to booking detail (AC: #1, #5)
  - [ ] 3.1 In the booking detail screen, add conditional rendering:
    - If `status === 'completed'` and no existing review: show "Leave a Review" button linking to `/review?bookingId=<id>`
    - If `status === 'completed'` and review exists: show the submitted review inline (stars + comment)
  - [ ] 3.2 Use `useBookingReview({ variables: { bookingId } })` to check for existing review

- [ ] Task 4: Fix any broken navigation or hooks (AC: #6, #7)
  - [ ] 4.1 Verify `src/app/review.tsx` exports `ReviewScreen` correctly (currently: `export { ReviewScreen as default } from '@/features/bookings/review-screen'`)
  - [ ] 4.2 Ensure navigation from booking detail to review screen passes `bookingId` correctly
  - [ ] 4.3 Verify error handling in `handleSubmit` shows appropriate alert messages
  - [ ] 4.4 Ensure `queryClient.invalidateQueries({ queryKey: ['bookingReview'] })` runs on success

- [ ] Task 5: Push notification tap to review (AC: #1)
  - [ ] 5.1 When a "service completed" push notification is tapped, navigate to `/review?bookingId=<id>` (depends on Epic 18 push notification tap handling, FR-6.13)

## Dev Notes

### Target Repo

**This is a MOBILE APP story.** All work is in `~/WebstormProjects/roadside-atl-mobile`.

### Existing Code Context

**Review screen** (`src/features/bookings/review-screen.tsx`):
Already implemented with `StarRating` component, comment input, and submit button. Uses `useSubmitReview` mutation and `useLocalSearchParams` for bookingId. Handles success (alert + navigate back) and error (alert with message). This story is primarily verification and integration, not new implementation.

**Review route** (`src/app/review.tsx`):
```typescript
export { ReviewScreen as default } from '@/features/bookings/review-screen';
```

**Review API hooks** (`src/features/bookings/api.ts`):
- `useSubmitReview` — `POST /api/bookings/:bookingId/review` with `{ rating, comment }`
- `useBookingReview` — `GET /api/bookings/:bookingId/review`, returns `ReviewResponse | null` (handles 404 gracefully)

**Review submission handler** in review-screen.tsx:
- Validates rating > 0 before submit
- Invalidates `bookingReview` query cache on success
- Shows error alert on failure with axios error message extraction

### Key Implementation Details

- The review screen and API hooks already exist and appear functional. The primary work is:
  1. Verifying end-to-end flow works with the current backend
  2. Adding the "Leave a Review" CTA to the booking detail screen
  3. Showing submitted reviews inline on completed bookings
  4. Wiring push notification tap-to-review navigation (FR-6.13)
- The `useBookingReview` hook handles 404 (no review) by returning `null` — use this to determine whether to show the CTA or the existing review.

### Mobile Conventions

- **Routing:** Expo Router file-based routing at `src/app/`
- **State:** React Query for server state, Zustand for local state
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **API hooks:** `react-query-kit` with `createQuery` / `createMutation`
- **Stack:** Expo SDK 54, React Native 0.81.5, TypeScript

### Dependencies

- Backend review endpoints must be deployed (existing in main repo)
- Epic 18 push notifications (for tap-to-review navigation, FR-6.13)
- Booking detail screen must show completed booking status

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 19, Story 19.5]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-6.11, FR-6.13]
- [Source: roadside-atl-mobile/src/features/bookings/review-screen.tsx]
- [Source: roadside-atl-mobile/src/features/bookings/api.ts — useSubmitReview, useBookingReview hooks]
- [Source: roadside-atl-mobile/src/app/review.tsx]

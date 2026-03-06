# Story 4.6: Booking Lifecycle & Notification Verification

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Epic: 4 - Enhanced Booking Experience -->
<!-- Story Key: 4-6-booking-lifecycle-and-notification-verification -->
<!-- Created: 2026-02-18 -->
<!-- Integration FRs: FR30 (booking confirmation SMS+email), FR31 (provider assignment notifications), FR40 (provider accept/decline with timeout), FR41 (provider job status lifecycle), FR50 (customer booking history & service records), FR52 (customer rate & review provider) -->
<!-- NFRs: NFR49 (SMS delivery tracking via statusCallback), NFR50 (email CAN-SPAM unsubscribe links) -->
<!-- Dependencies: Story 4.5 (real-time provider tracking) - DONE -->

## Story

As a customer,
I want booking confirmation, provider assignment, and status update notifications throughout the booking lifecycle,
so that I'm always informed about the status of my service.

## Acceptance Criteria

1. **Booking Confirmation Notifications** — Given I create a booking, when the booking is confirmed, then booking confirmation notifications are sent via SMS, email, AND push (FR30), SMS delivery status is tracked via Twilio statusCallback (NFR49), and email includes an unsubscribe link (NFR50).

2. **Provider Assignment Notifications** — Given a provider is assigned to my booking, when the assignment is made, then provider assignment notifications are sent to both customer and provider via SMS, email, and push (FR31), with NFR49/NFR50 compliance.

3. **Provider Accept/Decline Response** — Given a provider receives a job notification, when they accept or decline, then the customer is notified of the outcome via WebSocket broadcast (FR40). If declined, the booking is re-dispatched and the customer receives a real-time status update.

4. **Provider Job Status Lifecycle** — Given the provider is working a job, when they update status through the lifecycle (dispatched → in_progress → completed), then status transition validation prevents illegal transitions (FR41), and notifications are sent on each transition.

5. **Customer Booking History** — Given I have completed bookings, when I view my booking history, then I see accurate booking data with correctly scoped payment information (FR50).

6. **Customer Rate & Review** — Given I have a completed booking, when I view my booking history, then I can rate and review the provider via a clearly visible UI entry point (FR52).

## Tasks / Subtasks

- [x] Task 1: Wire push notifications into the notification orchestrator (AC: #1, #2)
  - [x] 1.1 In `lib/notifications/index.ts`, add import: `import { notifyBookingStatusPush, notifyProviderNewJobPush } from "./push";`
  - [x] 1.2 In `notifyBookingCreated()`, add `notifyBookingStatusPush(booking.userId, booking.id, "confirmed")` to the `Promise.allSettled` array — guard with `if (booking.userId)` since guest bookings have no userId
  - [x] 1.3 In `notifyProviderAssigned()`, add `notifyProviderNewJobPush(provider.id, booking.id, booking.contactName, serviceName)` to the `Promise.allSettled` array — requires adding `serviceName` parameter (or extract from booking context)
  - [x] 1.4 In `notifyStatusChange()`, add `notifyBookingStatusPush(booking.userId, booking.id, newStatus)` to the `Promise.allSettled` array — guard with `if (booking.userId)`
  - [x] 1.5 Update `BookingInfo` interface in `index.ts` to include `userId?: string | null` field — already available from booking record
  - [x] 1.6 Update all callers of `notifyBookingCreated`, `notifyProviderAssigned`, and `notifyStatusChange` to pass `userId` in the booking object — check `server/api/routes/bookings.ts`, `server/api/routes/provider.ts`, `server/api/routes/admin.ts`, `server/api/lib/auto-dispatch.ts`

- [x] Task 2: Add cancellation notifications and WebSocket broadcast (AC: #3)
  - [x] 2.1 In `server/api/routes/bookings.ts`, in the `PATCH /:id/cancel` handler (after line 200 audit log), add `notifyStatusChange(booking, "cancelled")` — fire-and-forget `.catch(() => {})`
  - [x] 2.2 Import `notifyStatusChange` from `@/lib/notifications` if not already imported
  - [x] 2.3 Add WebSocket broadcast after cancel: `broadcastToUser(booking.userId, { type: "booking:status_changed", data: { bookingId, status: "cancelled" } })` — guard with `if (booking.userId)`, fire-and-forget
  - [x] 2.4 Import `broadcastToUser` from `@/server/websocket/connections`

- [x] Task 3: Add provider rejection WebSocket broadcast to customer (AC: #3)
  - [x] 3.1 In `server/api/routes/provider.ts`, in the `PATCH /jobs/:id/reject` handler (after the existing `broadcastToAdmins` call), add `broadcastToUser(booking.userId, { type: "booking:status_changed", data: { bookingId, status: "confirmed" } })` — this tells the customer's my-bookings page the booking reverted to confirmed (re-dispatching). Guard with `if (booking.userId)`, fire-and-forget `.catch(() => {})`
  - [x] 3.2 Verify `broadcastToUser` is already imported in provider.ts (it is, from Story 4.5)

- [x] Task 4: Fix NFR49 — Add SMS delivery tracking to booking lifecycle SMS (AC: #1, #2)
  - [x] 4.1 In `lib/notifications/sms.ts`, update `sendBookingConfirmationSMS` to pass `statusCallback`: add `const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;` and pass `statusCallbackUrl ? { statusCallback: statusCallbackUrl } : undefined` as third argument to `sendSMS`
  - [x] 4.2 Apply same pattern to `sendProviderAssignmentSMS`
  - [x] 4.3 Apply same pattern to `sendStatusUpdateSMS`
  - [x] 4.4 Follow existing pattern from `sendObservationFollowUpSMS` (line 130-135) and `sendTierPromotionSMS` (line 164-169) which already implement this correctly

- [x] Task 5: Fix NFR50 — Add unsubscribe links to booking lifecycle emails (AC: #1, #2)
  - [x] 5.1 In `lib/notifications/email.ts`, in `sendBookingConfirmation` (line 43-64), add unsubscribe footer before the closing of the HTML: `<p style="font-size: 12px; color: #666;">If you no longer wish to receive these emails, <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com"}/unsubscribe">unsubscribe here</a>.</p>`
  - [x] 5.2 Apply same unsubscribe footer to `sendProviderAssignment` (line 66-89)
  - [x] 5.3 Apply same unsubscribe footer to `sendStatusUpdate` (line 91-119)
  - [x] 5.4 Follow existing pattern from `sendObservationFollowUpEmail` (line 137), `sendPreServiceConfirmationEmail` (line 163), `sendReferralCreditEmail` (line 183), `sendTierPromotionEmail` (line 203), `sendInspectionReportEmail` (line 229), `sendPaymentReceiptEmail` (line 280)

- [x] Task 6: Fix payments data leak in my-bookings page (AC: #5)
  - [x] 6.1 In `app/(marketing)/my-bookings/page.tsx`, line 32, change `where(eq(payments.status, "confirmed"))` to `where(and(inArray(payments.bookingId, bookingIds), eq(payments.status, "confirmed")))` — this scopes the query to only the current user's bookings
  - [x] 6.2 Import `and` and `inArray` from `drizzle-orm` if not already imported
  - [x] 6.3 Verify the `payments` schema has a `bookingId` column (it does — `db/schema/payments.ts`)

- [x] Task 7: Add booking status transition validation (AC: #4)
  - [x] 7.1 In `server/api/routes/provider.ts`, in the `PATCH /jobs/:id/status` handler (~line 198), add a valid transitions guard before the DB update. Define allowed transitions: `{ dispatched: ["in_progress"], in_progress: ["completed"], confirmed: ["cancelled"] }` — providers cannot set arbitrary statuses
  - [x] 7.2 If the requested transition is not in the allowed map, return `400` with error message `"Invalid status transition from {current} to {requested}"`
  - [x] 7.3 Keep the admin status handler (`server/api/routes/admin.ts`) unrestricted — admins can set any status as an override

- [x] Task 8: Add "Rate Provider" button to completed bookings in my-bookings (AC: #6)
  - [x] 8.1 In `app/(marketing)/my-bookings/my-bookings-client.tsx`, in the `BookingCard` component (~line 305-323), add a "Rate Provider" button next to the existing "Receipt" button for completed bookings with a provider: `<Button asChild variant="outline" size="sm"><Link href={`/track/${booking.id}#review`}><Star className="h-4 w-4 mr-1" />Review</Link></Button>`
  - [x] 8.2 The tracking page (`tracking-client.tsx`) already has a post-completion review form — linking to `/track/{id}#review` navigates there. Add an `id="review"` attribute to the review section in `tracking-client.tsx` if not already present
  - [x] 8.3 Import `Star` from `lucide-react` in my-bookings-client.tsx
  - [x] 8.4 Only show the Review button when the booking has a provider and status is "completed" — guard: `booking.status === "completed" && provider`

- [x] Task 9: TypeScript compilation check (AC: all)
  - [x] 9.1 Run `npx tsc --noEmit` — zero errors required

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** Read `_bmad-output/project-context.md` before writing any code — 127 rules are mandatory.

**This is primarily a WIRING and VERIFICATION story.** Most infrastructure already exists. The work is connecting pre-built pieces, fixing compliance gaps, and patching notification holes. Do NOT rebuild notification infrastructure — wire the existing pieces.

**No test framework installed.** Do NOT create test files.

**Integer math for money.** All money values in cents. Commission rates in basis points.

**Zod v4 import.** Always `import { z } from "zod/v4"` — NOT `"zod"`.

**Fire-and-forget for notifications.** Always `.catch(() => {})` — never await notification or broadcast calls in route handlers. The orchestrator functions in `index.ts` use `Promise.allSettled` internally, which is correct.

### THE CRITICAL GAP — Push Notifications Fully Built But Never Wired

The push notification system is 100% implemented but 0% connected:

**Built and working (`lib/notifications/push.ts`, 145 lines):**
```typescript
// These functions exist but are NEVER imported or called:
export async function notifyBookingStatusPush(userId, bookingId, status): Promise<void>
export async function notifyProviderNewJobPush(providerId, bookingId, customerName, serviceName): Promise<void>
```

**Infrastructure ready:**
- `pushSubscriptions` DB table exists with endpoint + keys columns
- VAPID key initialization on module load
- Subscription management API route at `/api/push` (subscribe/unsubscribe/status/resubscribe)
- Stale subscription cleanup on 410/404 errors
- Service worker registration in client

**The notification orchestrator (`lib/notifications/index.ts`) only imports from `./email` and `./sms`:**
```typescript
// CURRENT (line 1-12):
import { sendBookingConfirmation, ... } from "./email";
import { sendBookingConfirmationSMS, ... } from "./sms";
// ❌ MISSING: No import from "./push"
```

**THE FIX**: Add push imports to `index.ts` and include push calls in the existing `Promise.allSettled` arrays:

```typescript
// ADD to index.ts:
import { notifyBookingStatusPush, notifyProviderNewJobPush } from "./push";

// In notifyBookingCreated:
export async function notifyBookingCreated(booking: BookingInfo) {
  const tasks: Promise<unknown>[] = [
    sendBookingConfirmation(booking),
    sendBookingConfirmationSMS(booking.contactPhone, booking),
  ];
  if (booking.userId) {
    tasks.push(notifyBookingStatusPush(booking.userId, booking.id, "confirmed"));
  }
  await Promise.allSettled(tasks);
}
```

### Cancellation Notification Gap

**Current state (`server/api/routes/bookings.ts` lines 180-215):**
```typescript
// PATCH /:id/cancel handler:
const [updated] = await db.update(bookings).set({ status: "cancelled", updatedAt: new Date() }).where(eq(bookings.id, bookingId)).returning();
logAudit({ action: "booking.cancel", ... });
return c.json(updated);
// ❌ MISSING: No notifyStatusChange() call
// ❌ MISSING: No broadcastToUser() call
// Customer gets ZERO notification that their cancellation went through
```

**THE FIX**: After the audit log, add:
```typescript
notifyStatusChange(booking, "cancelled").catch(() => {});
if (booking.userId) {
  broadcastToUser(booking.userId, {
    type: "booking:status_changed",
    data: { bookingId, status: "cancelled" },
  });
}
```

### Provider Rejection Gap

**Current state (`server/api/routes/provider.ts` reject handler):**
- Provider declines → booking reverts to `"confirmed"` → `autoDispatchBooking()` called with exclusion
- `broadcastToAdmins()` is called
- NO `broadcastToUser()` to customer — customer has no idea their provider changed
- Their my-bookings page still shows "dispatched" until page refresh

**THE FIX**: Add `broadcastToUser(booking.userId, { type: "booking:status_changed", data: { bookingId, status: "confirmed" } })` after broadcastToAdmins.

### NFR49 Gap — SMS Delivery Tracking

**Functions WITH statusCallback (correct):** `sendObservationFollowUpSMS`, `sendTierPromotionSMS`
**Functions WITHOUT statusCallback (violation):** `sendBookingConfirmationSMS`, `sendProviderAssignmentSMS`, `sendStatusUpdateSMS`

**Pattern to follow (from `sendTierPromotionSMS` line 163-169):**
```typescript
export async function sendTierPromotionSMS(phone: string) {
  const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
  await sendSMS(
    phone,
    `RoadSide ATL: Congratulations! ...`,
    statusCallbackUrl ? { statusCallback: statusCallbackUrl } : undefined
  );
}
```

### NFR50 Gap — Email CAN-SPAM Compliance

**Emails WITH unsubscribe link (correct):** `sendObservationFollowUpEmail`, `sendPreServiceConfirmationEmail`, `sendReferralCreditEmail`, `sendTierPromotionEmail`, `sendInspectionReportEmail`, `sendPaymentReceiptEmail`

**Emails WITHOUT unsubscribe link (violation):** `sendBookingConfirmation`, `sendProviderAssignment`, `sendStatusUpdate`

**Pattern to follow (from existing emails):**
```html
<p style="font-size: 12px; color: #666;">If you no longer wish to receive these emails, <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com"}/unsubscribe">unsubscribe here</a>.</p>
```

### Payments Data Leak Bug

**Current code (`app/(marketing)/my-bookings/page.tsx` line 32):**
```typescript
const bookingPayments = bookingIds.length > 0
  ? await db.select().from(payments).where(eq(payments.status, "confirmed"))
  : [];
```

**THE BUG**: Queries ALL confirmed payments in the system, not just those for the current user's bookings. The `paymentMap.get(booking.id)` on line 40 masks this by filtering client-side, but the query returns every user's payment data from the database — a data leak and performance issue.

**THE FIX**:
```typescript
const bookingPayments = bookingIds.length > 0
  ? await db.select().from(payments).where(and(inArray(payments.bookingId, bookingIds), eq(payments.status, "confirmed")))
  : [];
```

### Status Transition Validation

**No centralized state machine exists.** The provider `PATCH /jobs/:id/status` handler accepts any value from the booking status enum with no guard. A provider could set a booking from `completed` back to `pending`.

**Valid provider transitions to enforce:**
```typescript
const VALID_PROVIDER_TRANSITIONS: Record<string, string[]> = {
  dispatched: ["in_progress"],
  in_progress: ["completed"],
  confirmed: ["cancelled"],
};
```

**FR41 note**: The AC mentions "en route → arrived → in progress → completed" but the DB enum only has `dispatched | in_progress | completed`. These map as: "en route" = `dispatched`, "arrived/in progress" = `in_progress`, "completed" = `completed`. Do NOT add new enum values — use the existing simplified lifecycle.

### Review Entry Point (FR52)

**Reviews API (`server/api/routes/reviews.ts`):** Fully built — `POST /` creates review with rating (1-5) + optional comment, validates booking ownership, prevents duplicate reviews, recalculates provider `averageRating`. CRUD complete.

**Missing UI link:** The `BookingCard` component in `my-bookings-client.tsx` shows a Receipt button for completed bookings but has NO Review/Rate button. The tracking page (`tracking-client.tsx`) already has a post-completion review form.

**THE FIX**: Add a "Review" button that links to `/track/${booking.id}#review` next to the Receipt button. Add `id="review"` to the review section in tracking-client.tsx for anchor navigation.

### Existing Notification Architecture

**Orchestrator pattern (`lib/notifications/index.ts`):**
- All orchestrator functions use `Promise.allSettled([email, sms])` — push will be added as a third element
- Fire-and-forget from route handlers: `notifyStatusChange(booking, status).catch(() => {})`
- Each channel (email, sms, push) handles its own errors gracefully (returns silently if not configured)

**WebSocket broadcast pattern:**
- `broadcastToUser(userId, event)` — sends to customer's my-bookings page (key: userId)
- `broadcastToAdmins(event)` — sends to all admin dashboards
- `broadcastToProvider(providerId, event)` — sends to provider's portal
- NOTE: The tracking page uses `broadcastToUser(booking.id, ...)` where key is the booking ID — this is separate from the customer user ID broadcasts

**Callers of notification functions (must all pass `userId`):**
| Caller | File | Function Called |
|---|---|---|
| POST /bookings (create) | bookings.ts:74 | `notifyBookingCreated(booking)` |
| PATCH /bookings/:id/cancel | bookings.ts:180 | NONE (gap!) |
| Auto-dispatch | auto-dispatch.ts | `notifyProviderAssigned(booking, provider)` |
| PATCH /provider/jobs/:id/accept | provider.ts:136 | `notifyStatusChange(booking, "in_progress")` |
| PATCH /provider/jobs/:id/status | provider.ts:242 | `notifyStatusChange(booking, status)` |
| PATCH /admin/bookings/:id/status | admin.ts | `notifyStatusChange(booking, status)` |
| Admin assign provider | admin.ts | `notifyProviderAssigned(booking, provider)` |

### Previous Story Learnings (Story 4.5)

- Fire-and-forget: `.catch(() => {})` for notifications/broadcasts, `.catch(() => null)` for dispatch
- `updatedAt: new Date()` in every `.update().set()` call
- `const [result] = await db.insert(...).returning()` destructure pattern
- The tracking page uses `booking.id` as WS key (not `booking.userId`) — this is intentional for guest booking support
- Provider location tracker polls every 30 seconds via `setInterval` + `getCurrentPosition`

### Gotchas

1. **`booking.userId` can be null.** Guest bookings created without authentication have `userId: null`. Guard all push notification calls with `if (booking.userId)` — push requires a user account to have subscriptions.

2. **`notifyProviderNewJobPush` takes `providerId`, not `userId`.** It internally looks up `provider.userId` from the providers table. This is by design since the auto-dispatch code only has the provider record.

3. **The `BookingInfo` interface in `index.ts` currently has no `userId` field.** You must add it: `userId?: string | null`. Then update all callers to include `userId` from the booking record when constructing the BookingInfo object.

4. **`sendSMS` has a 60-second rate limiter per phone number.** If a customer triggers multiple status changes in rapid succession, some SMS may be silently dropped. This is acceptable behavior — push and email will still deliver.

5. **The unsubscribe link goes to `/unsubscribe`.** This route must already exist (it's used by 6 other email functions). Do NOT create a new route — just add the same footer HTML.

6. **Status transition validation applies ONLY to the provider handler.** The admin handler must remain unrestricted — admins need to fix data issues by setting arbitrary statuses.

7. **The payments query fix requires `and()` and `inArray()` from drizzle-orm.** Check existing imports in `my-bookings/page.tsx` — they may need to be added.

### Project Structure Notes

- **Modify**: `lib/notifications/index.ts` — add push imports, wire push into all orchestrator functions, add `userId` to `BookingInfo`
- **Modify**: `lib/notifications/sms.ts` — add statusCallback to 3 booking lifecycle SMS functions (NFR49)
- **Modify**: `lib/notifications/email.ts` — add unsubscribe links to 3 booking lifecycle email functions (NFR50)
- **Modify**: `server/api/routes/bookings.ts` — add cancellation notifications + WS broadcast
- **Modify**: `server/api/routes/provider.ts` — add rejection WS broadcast + status transition validation
- **Modify**: `app/(marketing)/my-bookings/page.tsx` — fix payments data leak query
- **Modify**: `app/(marketing)/my-bookings/my-bookings-client.tsx` — add Review button for completed bookings
- **Modify**: `app/(marketing)/track/[id]/tracking-client.tsx` — add `id="review"` anchor to review section
- **No new files** — all changes are to existing files
- **No schema changes** — no new DB columns or enum values

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.6: Booking Lifecycle & Notification Verification]
- [Source: lib/notifications/index.ts — 122 lines (notification orchestrator, NO push imports)]
- [Source: lib/notifications/push.ts — 145 lines (fully built, NEVER imported)]
- [Source: lib/notifications/sms.ts — 186 lines (3 functions missing statusCallback)]
- [Source: lib/notifications/email.ts — 284 lines (3 functions missing unsubscribe links)]
- [Source: server/api/routes/bookings.ts — lines 180-215 (cancel handler, NO notifications)]
- [Source: server/api/routes/provider.ts — lines 151-195 (reject handler, NO customer broadcast)]
- [Source: server/api/routes/provider.ts — lines 198-268 (status handler, NO transition guard)]
- [Source: server/api/routes/reviews.ts — 265 lines (review CRUD, fully built)]
- [Source: app/(marketing)/my-bookings/page.tsx — line 32 (payments data leak query)]
- [Source: app/(marketing)/my-bookings/my-bookings-client.tsx — 330 lines (NO review button)]
- [Source: app/(marketing)/track/[id]/tracking-client.tsx — review form exists (needs anchor)]
- [Source: db/schema/bookings.ts — status enum: pending|confirmed|dispatched|in_progress|completed|cancelled]
- [Source: _bmad-output/project-context.md — 127 mandatory rules]
- [Source: _bmad-output/implementation-artifacts/4-5-real-time-provider-tracking.md — previous story learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Push notifications (web-push) wired into notification orchestrator — notifyBookingCreated, notifyProviderAssigned, notifyStatusChange all now include push channel via Promise.allSettled
- Customer cancel now sends SMS+email+push notification and WebSocket broadcast to both customer and admin
- Provider rejection now broadcasts booking:status_changed to customer via WebSocket so my-bookings updates in real-time
- NFR49 compliance: statusCallback added to sendBookingConfirmationSMS, sendProviderAssignmentSMS, sendStatusUpdateSMS for Twilio delivery tracking
- NFR50 compliance: Unsubscribe links added to sendBookingConfirmation, sendProviderAssignment, sendStatusUpdate emails
- Payments data leak fixed: my-bookings query now scopes payments to user's booking IDs via inArray filter
- Status transition validation added to provider status handler: only dispatched→in_progress, in_progress→completed, confirmed→cancelled allowed (admin unrestricted)
- Review button added to completed bookings in my-bookings with anchor link to tracking page review form
- ProviderInfo interface extended with id field; BookingInfo extended with userId field
- TypeScript compilation: zero errors
- **[Code Review Fix M1]**: Auto-dispatch now broadcasts booking:status_changed to customer via broadcastToUser after re-dispatch — previously customer's my-bookings showed stale status after provider rejection cascade
- **[Code Review Fix M2]**: Review button now checks hasReview flag — added reviews query in server component, passed hasReview boolean through serialized data, button hidden when review already exists

### File List

- lib/notifications/index.ts — Added push imports, userId to BookingInfo, id to ProviderInfo, wired push into all orchestrator functions
- lib/notifications/sms.ts — Added statusCallback to sendBookingConfirmationSMS, sendProviderAssignmentSMS, sendStatusUpdateSMS
- lib/notifications/email.ts — Added unsubscribe links to sendBookingConfirmation, sendProviderAssignment, sendStatusUpdate
- server/api/routes/bookings.ts — Added cancellation notifications (notifyStatusChange + broadcastToUser + broadcastToAdmins)
- server/api/routes/provider.ts — Added rejection WS broadcast to customer, status transition validation guard
- server/api/routes/admin.ts — Updated notifyProviderAssigned call to pass serviceName
- server/api/lib/auto-dispatch.ts — Updated notifyProviderAssigned call to pass serviceName
- app/(marketing)/my-bookings/page.tsx — Fixed payments data leak with inArray scoping
- app/(marketing)/my-bookings/my-bookings-client.tsx — Added Star import, Review button for completed bookings
- app/(marketing)/track/[id]/tracking-client.tsx — Added id="review" anchor to review section

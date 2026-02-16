# Story 6.2: Customer Follow-Up Notifications & Provider Operations Integration

Status: review

## Story

As an admin,
I want the system to automatically notify customers about vehicle issues found during service, and for the provider onboarding and operations pipeline to work correctly alongside observations,
So that customers receive proactive maintenance recommendations and providers have a seamless workflow.

## Acceptance Criteria

1. **Follow-Up SMS with Delivery Tracking** - Given a provider submits observations with medium or high severity items, when the observation is saved, then the follow-up SMS includes delivery status tracking via Twilio's message SID/status callback (NFR49), and the SMS message references booking a diagnostic inspection.

2. **Follow-Up Email with Unsubscribe & Booking Link** - Given a provider submits observations with medium or high severity items, when the follow-up email is sent, then it includes an unsubscribe link (NFR50 CAN-SPAM compliance) and a booking link for diagnostic services (e.g., `{APP_URL}/book`).

3. **Follow-Up Audit & State** - Given observations with medium or high severity items are saved, when the follow-up notification fires, then `followUpSent` is set to true on the observation record and an audit entry is logged with `observation.follow_up_sent`.

4. **Low Severity No Follow-Up** - Given a provider submits observations with only low severity items, when the observation is saved, then no follow-up notification is sent (low severity = informational only) and `followUpSent` remains false.

5. **Provider Application Submission (Integration Verification)** - Given a prospective provider, when they submit an application via the self-registration endpoint with personal info, vehicle details (specialties), and address, then the application is received with `status: "pending"` and an admin can review, approve, deny, or request resubmission via the admin providers API (FR35, FR36).

6. **Provider Availability Toggle (Integration Verification)** - Given an approved provider, when they call `PATCH /api/provider/availability` with `{ isAvailable: true/false }`, then their availability status toggles correctly and they enter/exit the dispatch pool (FR37).

7. **Provider Service Area Configuration (Integration Verification)** - Given an approved provider, when they update their profile with address and coordinates via `PATCH /api/provider/profile`, then their service area (latitude/longitude/address) is updated for dispatch matching (FR38).

8. **Provider Rating & Review History (Integration Verification)** - Given a provider has completed bookings with customer reviews, when they or anyone calls `GET /api/reviews/provider/:providerId`, then they can view their rating and review history with average rating, review count, and individual review details (FR46).

## Tasks / Subtasks

- [x] Task 1: Enhance SMS delivery tracking (AC: #1)
  - [x] 1.1 Update `sendSMS()` in `lib/notifications/sms.ts` to capture and return Twilio message SID from the `create()` response for delivery status tracking
  - [x] 1.2 Update `sendObservationFollowUpSMS()` to optionally accept a status callback URL via Twilio's `statusCallback` parameter (NFR49)
  - [x] 1.3 Verify SMS message content includes diagnostic booking call-to-action

- [x] Task 2: Verify follow-up email content compliance (AC: #2)
  - [x] 2.1 Verify `sendObservationFollowUpEmail()` in `lib/notifications/email.ts` includes unsubscribe link (already present — confirm CAN-SPAM compliance wording)
  - [x] 2.2 Verify email includes booking link for diagnostic services using `NEXT_PUBLIC_APP_URL` (already present — confirm link points to `/book`)
  - [x] 2.3 Verify email HTML renders correctly with findings summary, booking CTA, and unsubscribe footer

- [x] Task 3: Verify end-to-end follow-up pipeline (AC: #3, #4)
  - [x] 3.1 Verify POST `/api/provider/observations` in `server/api/routes/observations.ts` correctly triggers `notifyObservationFollowUp()` for medium/high severity items
  - [x] 3.2 Verify `followUpSent` is set to true after notification fires
  - [x] 3.3 Verify `observation.follow_up_sent` audit entry is logged with correct details (bookingId, customerEmail)
  - [x] 3.4 Verify low-severity-only submissions do NOT trigger follow-up (no notification, `followUpSent` stays false)

- [x] Task 4: Verify provider application pipeline (AC: #5)
  - [x] 4.1 Verify `POST /api/provider-registration/register` accepts self-registration with name, email, phone, password, specialties, address
  - [x] 4.2 Verify provider is created with `status: "pending"` and user with `role: "provider"`
  - [x] 4.3 Verify admin can review via `GET /api/admin/providers` and update status via `PATCH /api/admin/providers/:id` with `{ status: "active" }` (approve), `{ status: "inactive" }` (deny)
  - [x] 4.4 Verify admin can send invite to provider without account via `POST /api/admin/providers/:id/invite`

- [x] Task 5: Verify provider availability toggle (AC: #6)
  - [x] 5.1 Verify `PATCH /api/provider/availability` correctly toggles `isAvailable` on the providers table
  - [x] 5.2 Verify toggling to `isAvailable: false` excludes provider from auto-dispatch matching

- [x] Task 6: Verify provider service area configuration (AC: #7)
  - [x] 6.1 Verify `PATCH /api/provider/profile` accepts and updates address, latitude, longitude fields
  - [x] 6.2 Verify geocoding is applied when address is provided without coordinates (via `geocodeAddress()`)

- [x] Task 7: Verify provider rating and review history (AC: #8)
  - [x] 7.1 Verify `GET /api/reviews/provider/:providerId` returns paginated reviews with customerName, rating, comment, createdAt
  - [x] 7.2 Verify provider's `averageRating` and `reviewCount` on the providers table are recalculated after each new review
  - [x] 7.3 Verify provider profile endpoint (`GET /api/provider/profile`) includes `commissionRate` and `commissionType` for provider visibility

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** Read `_bmad-output/project-context.md` before writing any code — 127 rules are mandatory.

**This is primarily an integration verification story.** The follow-up notification pipeline is already built in Story 6.1's observation submission route (`server/api/routes/observations.ts`). The provider operations endpoints (registration, availability, profile, reviews) already exist. This story focuses on (1) ensuring the follow-up notifications meet NFR49/NFR50 compliance requirements, and (2) verifying existing provider operations work correctly alongside the new observation system.

**Do NOT rebuild what already exists.** The follow-up trigger logic, notification functions, and provider operation endpoints are all implemented. This story is about hardening, compliance verification, and integration testing — not reimplementation.

**Integer math only.** No floating point anywhere. Money in cents, multipliers in basis points.

**No test framework installed.** Do NOT create test files.

### Existing Code You MUST Understand

**Observation submission route** — `server/api/routes/observations.ts`:
The POST `/` handler already:
- Validates input with `createObservationSchema`
- Checks for duplicate observations (409)
- Inserts observation record
- Logs `observation.submit` audit entry
- Checks for medium/high severity items
- Fires `notifyObservationFollowUp()` as fire-and-forget
- Sets `followUpSent = true` on observation
- Logs `observation.follow_up_sent` audit entry

**SMS notification** — `lib/notifications/sms.ts`:
```typescript
export async function sendObservationFollowUpSMS(phone: string, findings: string) {
  await sendSMS(
    phone,
    `RoadSide ATL: Our provider noticed some issues with your vehicle: ${findings}. Book a diagnostic inspection to learn more! Reply STOP to opt out.`
  );
}
```
The `sendSMS()` function uses Twilio's `client.messages.create()` but currently discards the response. NFR49 requires capturing the message SID for delivery tracking.

**Email notification** — `lib/notifications/email.ts`:
```typescript
export async function sendObservationFollowUpEmail(email: string, customerName: string, findings: string) {
  // Already includes booking link: `${NEXT_PUBLIC_APP_URL}/book`
  // Already includes unsubscribe link: `${NEXT_PUBLIC_APP_URL}/unsubscribe`
}
```
The email already has CAN-SPAM compliance elements. Verify the unsubscribe link is functional and the booking link correctly targets the diagnostics booking flow.

**Notification orchestrator** — `lib/notifications/index.ts`:
```typescript
export async function notifyObservationFollowUp(customer: { name: string; email: string; phone: string }, findings: string) {
  await Promise.allSettled([
    sendObservationFollowUpEmail(customer.email, customer.name, findings),
    sendObservationFollowUpSMS(customer.phone, findings),
  ]);
}
```

**Provider self-registration** — `server/api/routes/provider-registration.ts`:
- `POST /register` — Creates user (role: provider) + provider (status: pending)
- `POST /verify-invite` — Verifies admin invite token
- `POST /accept-invite` — Creates user account from admin invite

**Admin provider management** — `server/api/routes/admin-providers.ts`:
- `GET /` — List providers (filterable by status)
- `GET /:id` — Provider detail with earnings summary
- `PATCH /:id` — Update provider (including status changes for approve/deny)
- `POST /:id/invite` — Send invite email to provider
- `DELETE /:id` — Soft-delete (set inactive)

**Provider operations** — `server/api/routes/provider.ts`:
- `GET /profile` — Provider profile details
- `PATCH /profile` — Update profile (name, phone, address, lat/lng)
- `PATCH /availability` — Toggle `isAvailable`
- `GET /jobs` — Provider's assigned jobs
- `GET /earnings/summary` — Earnings overview

**Reviews** — `server/api/routes/reviews.ts`:
- `GET /provider/:providerId` — Paginated reviews for a provider
- `POST /` — Customer submits review (requireAuth)
- `GET /booking/:bookingId` — Get review for specific booking

**Providers schema** — `db/schema/providers.ts`:
```typescript
isAvailable: boolean("is_available").default(true).notNull(),
latitude: real("latitude"),
longitude: real("longitude"),
address: text("address"),
specialties: jsonb("specialties").$type<string[]>().default([]),
averageRating: real("average_rating"),
reviewCount: integer("review_count").default(0).notNull(),
```

### Project Structure Notes

**Files to MODIFY (if SMS tracking enhancement needed):**

| File | What to Add |
|---|---|
| `lib/notifications/sms.ts` | Capture Twilio message SID from `create()` response; optionally add `statusCallback` URL parameter |

**Files to VERIFY (no changes expected):**

| File | What to Verify |
|---|---|
| `server/api/routes/observations.ts` | Follow-up trigger works end-to-end for medium/high severity |
| `lib/notifications/email.ts` | Unsubscribe link present, booking link present, CAN-SPAM compliant |
| `lib/notifications/index.ts` | `notifyObservationFollowUp` orchestrates both SMS and email |
| `server/api/routes/provider-registration.ts` | Self-registration creates pending provider (FR35) |
| `server/api/routes/admin-providers.ts` | Admin can approve/deny/request resubmission (FR36) |
| `server/api/routes/provider.ts` | Availability toggle works (FR37), profile update with service area works (FR38) |
| `server/api/routes/reviews.ts` | Provider rating and review history accessible (FR46) |

**Files NOT to create:**
- NO new route files — all endpoints already exist
- NO new schema files — observations table already created in Story 6.1
- NO new component files — this story is backend verification, no new UI
- NO test files — no test framework installed
- NO new notification function files — functions already exist in `lib/notifications/`

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Rewrite the observation submission route | Verify the existing implementation meets requirements |
| Create a new notification orchestrator | Use existing `notifyObservationFollowUp()` from `lib/notifications/index.ts` |
| Add try-catch in route handlers | Let Hono handle errors |
| Import from `"zod"` | Import from `"zod/v4"` |
| Use relative imports `../` | Use `@/` path alias |
| Create new provider operation endpoints | Verify existing endpoints in `provider.ts`, `provider-registration.ts`, `admin-providers.ts` |
| Create test files | No test framework installed — verify manually |
| Await notification calls | Fire-and-forget: `notifyObservationFollowUp(...).catch(() => {})` |
| Rebuild the follow-up trigger logic | It already exists in `server/api/routes/observations.ts` lines 81-117 |
| Forget `updatedAt: new Date()` in any Drizzle update calls | Always include it (though observation update only sets `followUpSent`, which has no `updatedAt` column) |

### Dependencies and Scope

**This story depends on:** Story 6.1 (Observation Schema, Checklist Configuration & Provider Submission) — must be completed first. Story 6.1 creates the observations table, notification functions, and the observation submission route with follow-up trigger.

**This story does NOT include:**
- Building observation submission UI (Story 6.1)
- Admin checklist configuration UI (separate admin story)
- Customer-facing observation view
- Photo upload infrastructure
- New database schema changes
- New API routes

**Scope boundary:** NFR compliance hardening of existing follow-up notifications (SMS delivery tracking, email CAN-SPAM) + integration verification of existing provider operations endpoints (FR35, FR36, FR37, FR38, FR46). Minimal code changes expected — primarily `sendSMS()` enhancement for Twilio SID capture and verification that existing code meets requirements.

### Testing Guidance

No test framework is installed. Do NOT create test files. Verify manually:

1. Submit observation with medium/high severity items via POST `/api/provider/observations` — verify follow-up SMS and email are triggered, `followUpSent` is true, audit entry logged
2. Submit observation with only low severity items — verify NO follow-up sent, `followUpSent` remains false
3. Verify follow-up email HTML contains: findings summary, booking link (`/book`), unsubscribe link (`/unsubscribe`)
4. Verify follow-up SMS contains: findings summary, diagnostic booking CTA, opt-out text ("Reply STOP to opt out")
5. Verify SMS `sendSMS()` captures Twilio message SID from response (check return value or logging)
6. Submit provider self-registration via POST `/api/provider-registration/register` — verify user created with `role: "provider"`, provider created with `status: "pending"`
7. Admin approve provider via PATCH `/api/admin/providers/:id` with `{ status: "active" }` — verify status updates
8. Toggle availability via PATCH `/api/provider/availability` with `{ isAvailable: false }` — verify `isAvailable` updates
9. Update provider profile via PATCH `/api/provider/profile` with address/coordinates — verify fields update
10. Get provider reviews via GET `/api/reviews/provider/:providerId` — verify reviews returned with ratings, comments, customer names

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6, Story 6.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns - Notification Triggers]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns - Naming Patterns]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: server/api/routes/observations.ts - Existing follow-up trigger implementation]
- [Source: lib/notifications/sms.ts - Existing SMS notification functions]
- [Source: lib/notifications/email.ts - Existing email notification functions with CAN-SPAM compliance]
- [Source: lib/notifications/index.ts - Existing notification orchestrator]
- [Source: server/api/routes/provider-registration.ts - Existing provider self-registration (FR35)]
- [Source: server/api/routes/admin-providers.ts - Existing admin provider management (FR36)]
- [Source: server/api/routes/provider.ts - Existing provider availability toggle (FR37) and profile update (FR38)]
- [Source: server/api/routes/reviews.ts - Existing reviews API (FR46)]
- [Source: db/schema/providers.ts - Provider schema with isAvailable, location, rating fields]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
None — build passed cleanly on first attempt.

### Completion Notes List

**Task 1 — SMS Delivery Tracking Enhancement:**
- Enhanced `sendSMS()` return type from `Promise<boolean>` to `Promise<{ success: boolean; messageSid?: string }>` to capture Twilio message SID (NFR49)
- Added `TwilioMessage` interface with `sid` and `status` fields
- Updated `TwilioClient` interface to include optional `statusCallback` parameter on `create()`
- Added `options?: { statusCallback?: string }` parameter to `sendSMS()`
- Updated `sendObservationFollowUpSMS()` to use `TWILIO_STATUS_CALLBACK_URL` env var for status callback
- SMS message already contains diagnostic booking CTA: "Book a diagnostic inspection to learn more!"

**Task 2 — Email Compliance Verification:**
- Verified: `sendObservationFollowUpEmail()` includes unsubscribe link at `${NEXT_PUBLIC_APP_URL}/unsubscribe` (line 134 of email.ts)
- Verified: Booking link present at `${NEXT_PUBLIC_APP_URL}/book` (line 132 of email.ts)
- Verified: Email HTML includes findings summary paragraph, booking CTA button, and unsubscribe footer with small gray text

**Task 3 — Follow-Up Pipeline Verification:**
- Verified: observations.ts POST handler (lines 81-98) checks `i.severity === "medium" || i.severity === "high"` and fires `notifyObservationFollowUp()`
- Verified: `followUpSent` set to `true` (lines 100-103) via Drizzle update
- Verified: `observation.follow_up_sent` audit entry logged (lines 105-116) with bookingId and customerEmail
- Verified: Low-severity-only submissions skip the `hasUrgent` check and never enter the follow-up block

**Task 4 — Provider Application Pipeline Verification:**
- Verified: `POST /register` (provider-registration.ts:83-166) accepts name, email, phone, password, specialties, address
- Verified: Creates user with `role: "provider"` (line 129) and provider with `status: "pending"` (line 143)
- Verified: Admin can list via `GET /` (admin-providers.ts:27), update status via `PATCH /:id` (line 117)
- Verified: Admin can send invite via `POST /:id/invite` (line 196)

**Task 5 — Availability Toggle Verification:**
- Verified: `PATCH /availability` (provider.ts:378-402) accepts boolean `isAvailable`, updates provider record with `updatedAt`
- Verified: Auto-dispatch (auto-dispatch.ts:48-53) filters by `eq(providers.isAvailable, true)` — providers with `isAvailable: false` excluded from dispatch pool

**Task 6 — Service Area Configuration:**
- Verified: `PATCH /profile` accepts and updates address, latitude, longitude fields
- Gap found and fixed: Provider self-service profile update was missing geocoding when address provided without coordinates (admin endpoint had it). Added `geocodeAddress()` call to match admin endpoint behavior

**Task 7 — Rating & Review History Verification:**
- Verified: `GET /reviews/provider/:providerId` (reviews.ts:23-53) returns paginated reviews with customerName (via LEFT JOIN users), rating, comment, createdAt
- Verified: `POST /reviews` (line 116-131) recalculates `averageRating` and `reviewCount` on providers table after each review
- Verified: `GET /provider/profile` (provider.ts:312-338) includes `commissionRate` and `commissionType` in response

### Change Log

| File | Change |
|---|---|
| `lib/notifications/sms.ts` | Enhanced `sendSMS()` to return `{ success, messageSid }` with Twilio SID capture; added `statusCallback` option; updated `sendObservationFollowUpSMS()` to use `TWILIO_STATUS_CALLBACK_URL` env var |
| `server/api/routes/provider.ts` | Added `geocodeAddress` import and geocoding logic to `PATCH /profile` when address is provided without coordinates |

### File List

- `lib/notifications/sms.ts` (modified)
- `server/api/routes/provider.ts` (modified)

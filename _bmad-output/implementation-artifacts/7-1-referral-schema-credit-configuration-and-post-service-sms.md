# Story 7.1: Referral Schema, Credit Configuration & Post-Service SMS

Status: review

## Story

As a platform operator,
I want customers to automatically receive a referral link via SMS after service completion,
so that every completed booking drives organic growth.

## Acceptance Criteria

1. **Referrals Table** - Given the `referrals` table does not exist, when the migration runs, then the table is created with: id, referrerId (FK users), refereeId (FK users, nullable), bookingId (FK bookings, nullable), creditAmount (int, cents), status (pending/credited/expired), createdAt. And a `referralStatusEnum` is created for the status column.

2. **Referral Code on Users** - Given the users table already has a `referralCode` (text, unique) column from Story 1.1, when a user has no referral code, then the system generates one on demand using `generateReferralCode()` from `server/api/lib/referral-credits.ts`.

3. **Credit Amount Constant** - Given referral credit amounts need to be configurable, when the implementation is set up, then a `REFERRAL_CREDIT_AMOUNT_CENTS` constant is defined in `lib/constants.ts` (default: 1000 = $10.00) and both referrer and referee receive this amount when a referral completes.

4. **Referral Credit Application** - Given a referee completes their first booking, when `applyReferralCredit()` is called, then the referral status transitions from "pending" to "credited" and an audit entry is logged with `referral.credit`.

5. **Post-Service Referral SMS** - Given a booking is completed and payment confirmed, when a configurable time period elapses (e.g., 30 minutes), then the customer receives an SMS with their unique referral link and SMS delivery status is tracked (NFR49).

6. **Referral Info API** - Given I am an authenticated user, when I call GET `/api/referrals/me`, then I receive my referral code, referral link, total referrals count, credited referrals count, and credit balance.

7. **Referral List API** - Given I am an authenticated user, when I call GET `/api/referrals`, then I receive a paginated list of my referrals with referee name, status, credit amount, and creation date.

8. **Referral Code Validation** - Given a new user is signing up with a referral code, when the code is submitted via POST `/api/referrals/validate`, then the system returns whether the code is valid and the referrer's name, without revealing whether the code exists on 404.

9. **Referral Application** - Given I am an authenticated user, when I apply a referral code via POST `/api/referrals/apply`, then a pending referral record is created linking the referrer and referee, with an audit entry logged as `referral.create`. Self-referral and duplicate referral are rejected.

10. **Audit Logging** - Given any referral state change occurs, when the operation completes, then audit entries are logged with the appropriate action (`referral.create`, `referral.credit`, `referral.expire`).

## Tasks / Subtasks

- [x] Task 1: Schema changes (AC: #1, #2)
  - [x] 1.1 Verify `db/schema/referrals.ts` exists with `referralStatusEnum` and referrals table (id, referrerId FK users, refereeId FK users nullable, bookingId FK bookings nullable, creditAmount int, status, createdAt)
  - [x] 1.2 Verify `referrals` export exists in `db/schema/index.ts`
  - [x] 1.3 Verify `referralCode` column already exists on `db/schema/users.ts` (text, unique)
  - [x] 1.4 Run `npm run db:generate` to create migration if schema changes needed
  - [x] 1.5 Run `npm run db:migrate` to apply migration

- [x] Task 2: Constants and validators (AC: #3, #8, #9)
  - [x] 2.1 Verify `REFERRAL_CREDIT_AMOUNT_CENTS` constant exists in `lib/constants.ts` (1000 = $10.00)
  - [x] 2.2 Verify `REFERRAL_STATUSES` constant and `ReferralStatus` type exist in `lib/constants.ts`
  - [x] 2.3 Verify `createReferralSchema` Zod schema exists in `lib/validators.ts`

- [x] Task 3: Audit logger extension (AC: #10)
  - [x] 3.1 Verify `referral.create`, `referral.credit`, and `referral.expire` exist in AuditAction type in `server/api/lib/audit-logger.ts`

- [x] Task 4: Referral credit logic (AC: #4)
  - [x] 4.1 Verify `server/api/lib/referral-credits.ts` exists with `applyReferralCredit()` and `generateReferralCode()` functions
  - [x] 4.2 Ensure `applyReferralCredit()` transitions referral status from "pending" to "credited" and logs `referral.credit` audit entry

- [x] Task 5: Notification functions (AC: #5)
  - [x] 5.1 Verify `sendReferralSMS` exists in `lib/notifications/sms.ts` with referral link message and STOP opt-out
  - [x] 5.2 Verify `sendReferralCreditSMS` exists in `lib/notifications/sms.ts` for credit earned notification
  - [x] 5.3 Verify `notifyReferralLink` orchestrator exists in `lib/notifications/index.ts`
  - [x] 5.4 Verify `notifyReferralCredit` orchestrator exists in `lib/notifications/index.ts`
  - [x] 5.5 Add post-service referral SMS trigger to booking completion flow — after payment confirmation, fire-and-forget `notifyReferralLink(phone, referralLink).catch(() => {})`

- [x] Task 6: API route (AC: #6, #7, #8, #9, #10)
  - [x] 6.1 Verify `server/api/routes/referrals.ts` exists with GET /me, GET /, POST /validate, POST /apply endpoints
  - [x] 6.2 Verify route is registered in `server/api/index.ts`: `app.route("/referrals", referralsRoutes)`
  - [x] 6.3 Ensure GET /me generates referral code on demand if user has none
  - [x] 6.4 Ensure POST /apply validates: referral code exists, not self-referral, no duplicate referral
  - [x] 6.5 Ensure POST /apply creates referral record with `REFERRAL_CREDIT_AMOUNT_CENTS` and logs `referral.create` audit

- [x] Task 7: Post-service SMS integration (AC: #5)
  - [x] 7.1 In the booking completion handler (status change to "completed" in `server/api/routes/admin.ts` and `server/api/routes/provider.ts`), add logic to send referral SMS after service completion
  - [x] 7.2 Look up user's referral code (generate if missing), construct referral link, call `notifyReferralLink()`
  - [x] 7.3 Fire-and-forget pattern: `notifyReferralLink(phone, referralLink).catch(() => {})`

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** Read `_bmad-output/project-context.md` before writing any code -- 127 rules are mandatory.

**Referral tracking uses a hybrid model.** The `referralCode` column lives on the `users` table (added in Story 1.1, already exists). The `referrals` table tracks the full credit lifecycle (pending/credited/expired). This separation exists because the referral code is a persistent user property (shareable, always the same), while referral records track individual redemptions.

**The referrals schema, route, credit logic, notification functions, and constants all already exist.** Previous stories scaffolded most of the referral infrastructure. This story's primary NEW work is the post-service SMS trigger -- wiring the referral link delivery into the booking completion flow.

**Integer math only.** No floating point anywhere. Money in cents (`REFERRAL_CREDIT_AMOUNT_CENTS = 1000` = $10.00).

**No test framework installed.** Do NOT create test files.

### Existing Code You MUST Understand

**Users table** -- `db/schema/users.ts`:
```typescript
export const users = pgTable("users", {
  // ... existing columns ...
  referralCode: text("referralCode").unique(),
  // ...
});
```
The `referralCode` column already exists. It is nullable -- generated on demand when a user first accesses their referral info via GET `/api/referrals/me`.

**Referrals table** -- `db/schema/referrals.ts`:
```typescript
export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "credited",
  "expired",
]);

export const referrals = pgTable("referrals", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  referrerId: text("referrerId").notNull().references(() => users.id),
  refereeId: text("refereeId").references(() => users.id),
  bookingId: text("bookingId").references(() => bookings.id),
  creditAmount: integer("creditAmount").notNull(), // cents
  status: referralStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});
```
This schema already exists and is exported from `db/schema/index.ts`.

**Referral credits lib** -- `server/api/lib/referral-credits.ts`:
```typescript
export async function applyReferralCredit(referralId: string): Promise<boolean> {
  // Transitions status from "pending" to "credited", logs referral.credit audit
}

export function generateReferralCode(): string {
  return crypto.randomUUID().slice(0, 8).toUpperCase();
}
```

**Referrals API route** -- `server/api/routes/referrals.ts`:
- `GET /me` -- Returns user's referral code, link, total/credited referrals, credit balance. Generates code on demand.
- `GET /` -- Paginated list of user's referrals with referee name, filterable by status.
- `POST /validate` -- Validates a referral code (returns `{ valid: true/false, referrerName }`).
- `POST /apply` -- Creates a pending referral record. Prevents self-referral and duplicates. Logs `referral.create`.

All endpoints use `requireAuth` middleware. Route registered at `/api/referrals` in `server/api/index.ts`.

**SMS functions** -- `lib/notifications/sms.ts`:
```typescript
export async function sendReferralSMS(phone: string, referralLink: string) {
  await sendSMS(phone,
    `RoadSide ATL: Thanks for using our service! Share your referral link and earn $10 credit: ${referralLink} Reply STOP to opt out.`
  );
}

export async function sendReferralCreditSMS(phone: string, amount: number) {
  await sendSMS(phone,
    `RoadSide ATL: You earned a ${formatPrice(amount)} referral credit! It will be applied to your next booking. Reply STOP to opt out.`
  );
}
```

**Notification orchestrators** -- `lib/notifications/index.ts`:
```typescript
export async function notifyReferralLink(phone: string, referralLink: string) {
  await sendReferralSMS(phone, referralLink);
}

export async function notifyReferralCredit(phone: string, amount: number) {
  await sendReferralCreditSMS(phone, amount);
}
```

**Audit logger** -- `server/api/lib/audit-logger.ts`:
Already includes `referral.create`, `referral.credit`, `referral.expire` in the AuditAction type union.

**Booking status change pattern** -- `server/api/routes/bookings.ts`:
When a booking status changes to "completed", the system already fires `notifyStatusChange()`. The post-service referral SMS trigger should be added alongside this, with the same fire-and-forget pattern.

**Constants** -- `lib/constants.ts`:
```typescript
export const REFERRAL_STATUSES = ["pending", "credited", "expired"] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];
export const REFERRAL_CREDIT_AMOUNT_CENTS = 1000; // $10.00
```

### Exact Implementation Specifications

**The primary new implementation work for this story is the post-service referral SMS trigger.** Most infrastructure already exists.

**1. Post-Service Referral SMS Trigger (NEW):**

In the booking completion flow (when status changes to "completed" or when payment is confirmed), add:

```typescript
// After booking completion notification is sent...
// Send referral link SMS (fire-and-forget)
if (booking.contactPhone) {
  const bookingUser = booking.userId
    ? await db.query.users.findFirst({ where: eq(users.id, booking.userId) })
    : null;

  if (bookingUser) {
    let referralCode = bookingUser.referralCode;
    if (!referralCode) {
      referralCode = generateReferralCode();
      await db
        .update(users)
        .set({ referralCode, updatedAt: new Date() })
        .where(eq(users.id, bookingUser.id));
    }
    const referralLink = `${process.env.NEXT_PUBLIC_APP_URL || ""}/register?ref=${referralCode}`;
    notifyReferralLink(booking.contactPhone, referralLink).catch(() => {});
  }
}
```

This should be triggered after the completion notification, not blocking the response. Use fire-and-forget pattern.

**2. Verify all existing infrastructure matches spec:**

Verify each of the following files exists and matches the acceptance criteria:
- `db/schema/referrals.ts` -- referrals table with referralStatusEnum
- `db/schema/index.ts` -- exports referrals
- `lib/constants.ts` -- REFERRAL_CREDIT_AMOUNT_CENTS, REFERRAL_STATUSES
- `lib/validators.ts` -- createReferralSchema
- `server/api/lib/referral-credits.ts` -- applyReferralCredit, generateReferralCode
- `server/api/routes/referrals.ts` -- GET /me, GET /, POST /validate, POST /apply
- `server/api/index.ts` -- route registered at /referrals
- `lib/notifications/sms.ts` -- sendReferralSMS, sendReferralCreditSMS
- `lib/notifications/index.ts` -- notifyReferralLink, notifyReferralCredit
- `server/api/lib/audit-logger.ts` -- referral.create, referral.credit, referral.expire

### Project Structure Notes

**Files to CREATE:**

| File | Purpose |
|---|---|
| None -- all files already exist | Infrastructure was scaffolded in prior stories |

**Files to MODIFY (append/extend):**

| File | What to Add |
|---|---|
| `server/api/routes/bookings.ts` | Post-service referral SMS trigger on booking completion |

**Files to VERIFY (already exist, confirm correct):**

| File | What to Verify |
|---|---|
| `db/schema/referrals.ts` | referralStatusEnum + referrals table schema matches AC #1 |
| `db/schema/users.ts` | `referralCode` column exists (text, unique) |
| `db/schema/index.ts` | `export * from "./referrals"` present |
| `lib/constants.ts` | `REFERRAL_CREDIT_AMOUNT_CENTS = 1000`, `REFERRAL_STATUSES` |
| `lib/validators.ts` | `createReferralSchema` with referralCode string validation |
| `server/api/lib/referral-credits.ts` | `applyReferralCredit()` + `generateReferralCode()` |
| `server/api/lib/audit-logger.ts` | `referral.create`, `referral.credit`, `referral.expire` in AuditAction |
| `server/api/routes/referrals.ts` | GET /me, GET /, POST /validate, POST /apply with requireAuth |
| `server/api/index.ts` | `app.route("/referrals", referralsRoutes)` |
| `lib/notifications/sms.ts` | `sendReferralSMS`, `sendReferralCreditSMS` |
| `lib/notifications/index.ts` | `notifyReferralLink`, `notifyReferralCredit` orchestrators |

**Files NOT to create:**
- NO `db/schema/referral-credits.ts` -- credit logic lives in `server/api/lib/referral-credits.ts`
- NO `lib/referrals/` directory -- validators in `lib/validators.ts`, constants in `lib/constants.ts`
- NO `types/referrals.ts` -- types co-located in schema file or inferred from Zod
- NO customer-facing referral page -- Story 7.2 handles the customer referral dashboard UI
- NO referral credit redemption during booking -- Story 7.2 handles credit application at booking time

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Create a separate referral config table | Use `REFERRAL_CREDIT_AMOUNT_CENTS` constant in `lib/constants.ts` |
| Create `lib/referrals/` directory | Put constants in `lib/constants.ts`, validators in `lib/validators.ts` |
| Import from `"zod"` | Import from `"zod/v4"` |
| Use relative imports `../` | Use `@/` path alias |
| Skip audit logging for referral operations | Log `referral.create` for every new referral, `referral.credit` for every credit application |
| Await notification calls | Fire-and-forget: `notifyReferralLink(...).catch(() => {})` |
| Add try-catch in route handlers | Let Hono handle errors |
| Forget `updatedAt: new Date()` when updating users with referral code | Always include it |
| Send referral SMS synchronously in the booking completion response | Fire-and-forget after the response is sent |
| Block the booking completion response for referral code generation | Handle referral code generation asynchronously |
| Create customer referral page or credit redemption UI | That is Story 7.2 scope |
| Reveal whether a referral code exists on validation failure | Return `{ valid: false }` generically |

### Dependencies and Scope

**This story blocks:** Story 7.2 (Referral Tracking, Credits & Provider Referrals)

**This story does NOT include:**
- Customer-facing referral dashboard page (Story 7.2)
- Referral credit redemption at booking time (Story 7.2)
- Provider-to-provider referrals (Story 7.2)
- Referral expiration cron job or scheduled task
- Admin referral management UI

**Scope boundary:** Schema verification + API route verification + notification function verification + NEW post-service referral SMS trigger integration in booking completion flow. Most infrastructure is already built; this story's primary deliverable is wiring the SMS trigger into the booking lifecycle.

### Testing Guidance

No test framework is installed. Do NOT create test files. Verify manually:

1. Verify migration -- confirm referrals table exists with correct columns and referralStatusEnum
2. GET /api/referrals/me -- verify referral code returned (generated if missing), referral stats correct
3. GET /api/referrals -- verify paginated referral list with status filter
4. POST /api/referrals/validate -- verify valid code returns `{ valid: true, referrerName }`, invalid returns `{ valid: false }`
5. POST /api/referrals/apply -- verify referral record created, audit logged as `referral.create`
6. POST /api/referrals/apply with self-referral -- verify 400 error
7. POST /api/referrals/apply with duplicate -- verify 400 error
8. Complete a booking -- verify referral SMS sent to customer with their referral link
9. Complete a booking for a guest (no userId) -- verify no SMS error, graceful skip
10. Apply referral credit -- verify status transitions to "credited", audit logged as `referral.credit`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7, Story 7.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture - Referral Tracking (Decision 1.5)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns - Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns - New Feature File Organization]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns - Notification Triggers]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: db/schema/referrals.ts - Existing referrals table definition]
- [Source: db/schema/users.ts - Existing referralCode column on users]
- [Source: server/api/routes/referrals.ts - Existing referral API endpoints]
- [Source: server/api/lib/referral-credits.ts - Existing credit application and code generation logic]
- [Source: server/api/lib/audit-logger.ts - Existing referral audit action types]
- [Source: lib/constants.ts - Existing REFERRAL_CREDIT_AMOUNT_CENTS and REFERRAL_STATUSES]
- [Source: lib/validators.ts - Existing createReferralSchema]
- [Source: lib/notifications/sms.ts - Existing sendReferralSMS and sendReferralCreditSMS]
- [Source: lib/notifications/index.ts - Existing notifyReferralLink and notifyReferralCredit orchestrators]
- [Source: server/api/index.ts - Route registration for referrals]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
None — build passed cleanly on first attempt.

### Completion Notes List

**Tasks 1-6 — Infrastructure Verification:**
All referral infrastructure already existed and was verified correct:
- Schema: `db/schema/referrals.ts` with referralStatusEnum, referrals table with all required columns and FKs ✓
- Exports: `db/schema/index.ts` includes `export * from "./referrals"` ✓
- Users: `referralCode` column exists (text, unique, nullable) ✓
- Constants: `REFERRAL_CREDIT_AMOUNT_CENTS = 1000`, `REFERRAL_STATUSES`, `ReferralStatus` ✓
- Validators: `createReferralSchema` with `referralCode: z.string().min(1)` ✓
- Audit: `referral.create`, `referral.credit`, `referral.expire` in AuditAction type ✓
- Credit logic: `applyReferralCredit()` transitions pending→credited with audit log, `generateReferralCode()` uses `crypto.randomUUID().slice(0,8).toUpperCase()` ✓
- SMS: `sendReferralSMS` and `sendReferralCreditSMS` in sms.ts with STOP opt-out ✓
- Orchestrators: `notifyReferralLink` and `notifyReferralCredit` in notifications/index.ts ✓
- API routes: GET /me (with on-demand code generation), GET / (paginated), POST /validate (generic 404), POST /apply (anti-self-referral, anti-duplicate, audit logging) ✓
- Route registration: `app.route("/referrals", referralsRoutes)` in server/api/index.ts ✓
- Migration: Already applied (0008_windy_korg.sql includes referrals table and referralStatusEnum) ✓

**Task 7 — Post-Service Referral SMS (NEW WORK):**
Added post-service referral SMS trigger to both booking completion handlers:
1. `server/api/routes/admin.ts` — When admin sets booking status to "completed" (inside existing `if (parsed.data.status === "completed")` block)
2. `server/api/routes/provider.ts` — When provider sets job status to "completed" (new `if (parsed.data.status === "completed")` block)

Both implementations follow the same pattern:
- Check booking has `contactPhone` and `userId` (skip for guest bookings)
- Look up user's referral code, generate if missing (via `generateReferralCode()`)
- Update user record with new code (including `updatedAt`)
- Construct referral link: `${NEXT_PUBLIC_APP_URL}/register?ref=${referralCode}`
- Fire-and-forget: `notifyReferralLink(phone, referralLink).catch(() => {})`
- Entire operation wrapped in IIFE with catch to prevent any failure from affecting the response

### Change Log

| File | Change |
|---|---|
| `server/api/routes/admin.ts` | Added `notifyReferralLink` import, `generateReferralCode` import, post-service referral SMS trigger in booking completion block |
| `server/api/routes/provider.ts` | Added `notifyReferralLink` import, `users` schema import, `generateReferralCode` import, post-service referral SMS trigger when provider sets status to "completed" |

### File List

- `server/api/routes/admin.ts` (modified)
- `server/api/routes/provider.ts` (modified)

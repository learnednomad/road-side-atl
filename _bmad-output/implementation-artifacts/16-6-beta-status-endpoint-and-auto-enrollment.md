# Story 16.6: Beta Status Endpoint and Auto-Enrollment

Status: backlog

## Story

As a customer or mobile app,
I want to check whether the beta is active and whether I am enrolled,
so that the UI can display beta-specific features and track my beta participation automatically when I book a service.

## Acceptance Criteria

1. **Beta Status Endpoint** - Given a new `GET /api/beta/status` endpoint, when called by an authenticated user, then it returns `{ active: boolean, startDate: string | null, endDate: string | null, enrolled: boolean }` where `active` reflects the current beta state, dates come from platform_settings, and `enrolled` indicates whether the user has a row in `beta_users`.

2. **Unauthenticated Access** - Given `GET /api/beta/status` is called without authentication, when processed, then it returns `{ active: boolean, startDate: string | null, endDate: string | null, enrolled: false }` (beta state is public, enrollment requires auth).

3. **Auto-Enrollment on Booking** - Given beta mode is active and a user creates a booking via `POST /api/bookings`, when the booking is successfully created, then the user is auto-enrolled in `beta_users` with `source: "booking"` using `onConflictDoNothing()` (fire-and-forget).

4. **Idempotent Enrollment** - Given a user is already enrolled in `beta_users`, when they create another booking during beta, then the enrollment insert is silently skipped (no error, no duplicate row).

5. **No Enrollment Outside Beta** - Given beta mode is NOT active, when a user creates a booking, then no `beta_users` insert is attempted.

## Tasks / Subtasks

- [ ] Task 1: Create beta route module (AC: #1, #2)
  - [ ] 1.1 Create beta route handler (either as `server/api/routes/beta.ts` or add to an existing route file)
  - [ ] 1.2 Implement `GET /status` returning beta active state, dates, and enrollment
  - [ ] 1.3 Read `beta_mode_active`, `beta_start_date`, `beta_end_date` from `platform_settings`
  - [ ] 1.4 Check if current user (from session, if authenticated) has a `beta_users` row
  - [ ] 1.5 Register the route in the Hono app (main API router)

- [ ] Task 2: Add auto-enrollment to bookings (AC: #3, #4, #5)
  - [ ] 2.1 In `POST /api/bookings` handler in `server/api/routes/bookings.ts`, after successful booking creation, add beta enrollment check
  - [ ] 2.2 Call `isBetaActive()` — if true, insert into `beta_users` with `source: "booking"` and `onConflictDoNothing()`
  - [ ] 2.3 Make enrollment fire-and-forget: `.catch((err) => { console.error("[Beta] Enrollment failed:", err); })`
  - [ ] 2.4 Only attempt if `booking.userId` is not null (skip guest bookings)

- [ ] Task 3: TypeScript verification
  - [ ] 3.1 Run `npx tsc --noEmit` to verify TypeScript compiles cleanly

## Dev Notes

### Critical Architecture Constraints

**Auto-enrollment is fire-and-forget.** Beta enrollment must NEVER block or fail the booking flow. Use `.catch()` with error logging — the booking succeeds regardless of enrollment outcome.

**`onConflictDoNothing()` is mandatory.** Users may book multiple times during beta. The unique constraint on `userId` prevents duplicates, and `onConflictDoNothing()` ensures no error is thrown.

**Beta status is partially public.** The `active`, `startDate`, and `endDate` fields are public information. The `enrolled` field requires checking the authenticated user's beta_users row — if no auth, return `enrolled: false`.

**Route registration.** Check how existing routes are mounted in the main Hono app. The beta route should be mounted at `/api/beta`.

### Existing Code You MUST Understand

**Beta helper** — `server/api/lib/beta.ts` (created in Story 16.4):
```typescript
export async function isBetaActive(): Promise<boolean> {
  // Reads beta_mode_active from platform_settings with 60s cache
}
```

**Beta users table** — `db/schema/beta-users.ts` (created in Story 16.2):
```typescript
export const betaUsers = pgTable("beta_users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  enrolledAt: timestamp("enrolledAt", { mode: "date" }).defaultNow().notNull(),
  source: text("source").notNull(),
  convertedAt: timestamp("convertedAt", { mode: "date" }),
});
```

**Platform settings** — `db/schema/platform-settings.ts`:
```typescript
export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  key: text("key").unique().notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
```

**Bookings route pattern** — The existing `POST /api/bookings` handler creates a booking and returns the result. The auto-enrollment should be added after the booking insert succeeds, as a fire-and-forget side effect.

**Auth session pattern** — Check how existing routes access the authenticated user. Typically via middleware that puts `user` on the Hono context: `const user = c.get("user")`.

### Exact Implementation Specifications

**1. Beta route (`server/api/routes/beta.ts` — new file):**

```typescript
import { Hono } from "hono";
import { db } from "@/db";
import { platformSettings, betaUsers } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { isBetaActive } from "@/server/api/lib/beta";

const app = new Hono();

app.get("/status", async (c) => {
  const active = await isBetaActive();

  // Read dates from platform_settings
  const settings = await db.query.platformSettings.findMany({
    where: inArray(platformSettings.key, ["beta_start_date", "beta_end_date"]),
  });
  const startDate = settings.find(s => s.key === "beta_start_date")?.value ?? null;
  const endDate = settings.find(s => s.key === "beta_end_date")?.value ?? null;

  // Check enrollment if authenticated
  let enrolled = false;
  const user = c.get("user") as { id: string } | undefined;
  if (user?.id) {
    const betaUser = await db.query.betaUsers.findFirst({
      where: eq(betaUsers.userId, user.id),
    });
    enrolled = !!betaUser;
  }

  return c.json({ active, startDate, endDate, enrolled });
});

export default app;
```

**2. Auto-enrollment in bookings route:**

Add after successful booking creation in `server/api/routes/bookings.ts`:
```typescript
// Beta auto-enrollment (fire-and-forget)
if (booking.userId) {
  isBetaActive().then(async (active) => {
    if (active) {
      await db.insert(betaUsers).values({
        userId: booking.userId!,
        source: "booking",
      }).onConflictDoNothing();
    }
  }).catch((err) => { console.error("[Beta] Enrollment failed:", err); });
}
```

**3. Route registration** — Mount the beta route in the main API router:
```typescript
import beta from "./routes/beta";
app.route("/beta", beta);
```

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Await the beta enrollment in booking flow | Fire-and-forget with `.catch()` |
| Throw on duplicate enrollment | Use `onConflictDoNothing()` |
| Require auth for beta active status | Active state is public; enrollment check is auth-optional |
| Create a separate enrollment endpoint | Auto-enrollment is implicit on booking |
| Read all platform_settings in status endpoint | Read only the 2-3 keys you need |
| Block booking creation if enrollment fails | Enrollment is a side effect — never blocks |

### Dependencies and Scope

**Depends on:** Story 16.2 (beta_users table), Story 16.4 (beta helper + `isBetaActive()`)

**This story blocks:** Story 16.7 (admin beta toggle references beta status)

**This story does NOT include:**
- Admin beta toggle UI (Story 16.7)
- Admin dashboard beta stats (Story 16.7)
- Booking flow validation for scheduledAt (Story 17.1)
- Trust tier bypass logic (Story 16.4)

### Testing Guidance

No test framework is installed. Verify manually:
1. Set `beta_mode_active` to `"true"` in platform_settings
2. `GET /api/beta/status` (no auth) — returns `{ active: true, startDate: "2026-04-07", endDate: "2026-06-07", enrolled: false }`
3. `GET /api/beta/status` (authenticated) — returns `enrolled: false` (if not yet enrolled)
4. Create a booking via `POST /api/bookings` — booking succeeds
5. Check `beta_users` table — row exists for the booking user with `source: "booking"`
6. `GET /api/beta/status` (same user) — returns `enrolled: true`
7. Create another booking — no duplicate beta_users row
8. Set `beta_mode_active` to `"false"`, create booking — no beta_users insert
9. `npx tsc --noEmit` compiles without errors

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 16, Story 16.6]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-2.5, FR-2.6]
- [Source: _bmad-output/planning-artifacts/architecture.md#Beta enrollment pattern]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 3: Beta Mode via Platform Settings]
- [Source: server/api/lib/beta.ts — isBetaActive() helper (Story 16.4)]
- [Source: db/schema/beta-users.ts — Beta users table (Story 16.2)]

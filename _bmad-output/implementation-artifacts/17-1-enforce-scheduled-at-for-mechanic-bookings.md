# Story 17.1: Enforce scheduledAt for Mechanic Bookings

Status: backlog

## Story

As a customer,
I want the system to reject mechanic bookings that lack a scheduled date,
so that mechanic services are always booked for a specific future time and never dispatched immediately.

## Acceptance Criteria

1. **Scheduled-only validation** - Given a service with `schedulingMode === "scheduled"`, when a customer submits `POST /api/bookings` without a `scheduledAt` field, then the API returns 400 with message "Mechanic services require a scheduled date".

2. **Past-date rejection** - Given a service with `schedulingMode === "scheduled"`, when a customer submits `POST /api/bookings` with a `scheduledAt` value in the past, then the API returns 400 with message "Scheduled time must be at least 2 hours from now".

3. **Valid scheduled booking succeeds** - Given a service with `schedulingMode === "scheduled"`, when a customer submits `POST /api/bookings` with a valid `scheduledAt` at least 2 hours in the future, then the booking is created successfully with the scheduled timestamp persisted.

4. **Non-mechanic services unaffected** - Given a service with `schedulingMode === "both"` or `schedulingMode === "immediate"`, when a customer submits `POST /api/bookings` without `scheduledAt`, then the booking is created as an immediate booking (existing behavior preserved).

5. **Beta user auto-enrollment** - Given beta mode is active (`isBetaActive() === true`), when a customer creates any booking, then the user is auto-enrolled in `beta_users` table (fire-and-forget, idempotent via `onConflictDoNothing`).

## Tasks / Subtasks

- [ ] Task 1: Add schedulingMode validation to booking handler (AC: #1, #2, #3, #4)
  - [ ] 1.1 In `POST /api/bookings` handler in `server/api/routes/bookings.ts`, after fetching the service, check `service.schedulingMode`
  - [ ] 1.2 If `schedulingMode === "scheduled"` and `data.scheduledAt` is null/undefined, return 400 with `"Mechanic services require a scheduled date"`
  - [ ] 1.3 Existing Zod `.refine()` in `createBookingSchema` already handles the 2-hour minimum check; verify it still applies correctly when `scheduledAt` is present
  - [ ] 1.4 Verify services with `schedulingMode === "both"` or `schedulingMode === "immediate"` pass through without the new check

- [ ] Task 2: Add beta user auto-enrollment (AC: #5)
  - [ ] 2.1 Import `isBetaActive` from `@/server/api/lib/beta` and `betaUsers` from `@/db/schema`
  - [ ] 2.2 After booking creation, if `isBetaActive()` returns true and `userId` is not null, insert into `beta_users` with `source: "booking"` using `onConflictDoNothing()`
  - [ ] 2.3 Use fire-and-forget pattern: `.catch((err) => { console.error("[Beta] Enrollment failed:", err); })`

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** The booking handler already exists and handles service lookup, pricing, geocoding, and dispatch. The schedulingMode check is a small guard inserted after the service fetch.

**No try-catch in Hono handlers.** Hono handles errors. Do not wrap the validation in try-catch.

**Manual updatedAt.** Every `.update().set()` call must include `updatedAt: new Date()`.

**Zod v4 only.** All imports from `"zod/v4"`, never `"zod"`.

### Existing Code You MUST Understand

**Booking creation handler** -- `server/api/routes/bookings.ts` (lines 26-42):
```typescript
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const data = parsed.data;

  // Look up service
  const service = await db.query.services.findFirst({
    where: eq(services.id, data.serviceId),
  });
  if (!service) {
    return c.json({ error: "Service not found" }, 404);
  }
```

**Insert the schedulingMode check right after the service-not-found guard (after line 41).** The check is:
```typescript
// Enforce scheduled-only for mechanic services (FR-1.4)
if (service.schedulingMode === "scheduled" && !data.scheduledAt) {
  return c.json({ error: "Mechanic services require a scheduled date" }, 400);
}
```

**Existing Zod refinement** -- `lib/validators.ts` (lines 22-35):
```typescript
export const createBookingSchema = z.object({
  serviceId: z.string().uuid("Invalid service"),
  // ...
  scheduledAt: z.string().datetime().optional(),
  // ...
}).refine(
  (data) => !data.scheduledAt || new Date(data.scheduledAt) > new Date(Date.now() + 2 * 60 * 60 * 1000),
  { message: "Scheduled time must be at least 2 hours from now", path: ["scheduledAt"] }
);
```
The existing refinement already rejects past dates and dates within 2 hours. No changes needed to the Zod schema.

**Beta enrollment pattern** (from architecture.md Decision 3):
```typescript
if (await isBetaActive()) {
  db.insert(betaUsers).values({
    userId: booking.userId,
    source: "booking",
  }).onConflictDoNothing()
    .catch(err => console.error("[Beta] Enrollment failed:", err));
}
```

### Project Structure Notes

**Files to MODIFY:**

| File | What to Add |
|---|---|
| `server/api/routes/bookings.ts` | schedulingMode guard after service lookup, beta enrollment after booking creation |

**Files NOT to create:**
- NO new route files -- this modifies the existing bookings handler
- NO new middleware -- validation is inline in the handler per architecture Decision 2
- NO new Zod schemas -- existing `createBookingSchema` handles `scheduledAt` validation

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Add schedulingMode check in middleware | Check inline after service fetch in handler |
| Modify `createBookingSchema` for schedulingMode | Check at runtime after service lookup (schema doesn't know the service type) |
| Use try-catch around the validation | Let Hono handle errors |
| Import from `"zod"` | Import from `"zod/v4"` |
| Await beta enrollment | Fire-and-forget with `.catch()` |

### Dependencies and Scope

**This story depends on:** Epic 16 (services table must have `schedulingMode` column and mechanic services seeded)

**This story blocks:** Story 17.2 (cron dispatch), Story 17.4 (web UI)

**This story does NOT include:**
- Cron-based mechanic dispatch (Story 17.2)
- Observation upsell pipeline (Story 17.3)
- Web UI changes for mechanic booking (Story 17.4)

### Testing Guidance

Verify manually:
1. `POST /api/bookings` with a mechanic service (`schedulingMode = "scheduled"`) and no `scheduledAt` returns 400
2. `POST /api/bookings` with a mechanic service and `scheduledAt` 1 hour from now returns 400 (Zod refinement)
3. `POST /api/bookings` with a mechanic service and `scheduledAt` 3 hours from now succeeds
4. `POST /api/bookings` with a roadside service (`schedulingMode = "both"`) and no `scheduledAt` succeeds (existing behavior)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 17, Story 17.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 2: Scheduling Mode Column]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-1.4]
- [Source: server/api/routes/bookings.ts - Existing booking creation handler]
- [Source: lib/validators.ts - Existing createBookingSchema with scheduledAt refinement]

# Story 17.2: Mechanic Pre-Dispatch Cron Job

Status: backlog

## Story

As a platform operator,
I want mechanic bookings to be automatically dispatched to the nearest qualified provider 2 hours before the scheduled appointment,
so that providers have time to prepare parts and route to the customer without manual admin intervention.

## Acceptance Criteria

1. **Cron job registration** - Given the server starts, when cron jobs are initialized, then a `mechanic-pre-dispatch` job is registered with a 15-minute interval.

2. **Eligible booking query** - Given mechanic bookings exist with `status = "confirmed"`, `providerId IS NULL`, and `scheduledAt` within the next 2 hours, when the cron fires, then exactly those bookings are selected for dispatch.

3. **Dispatch execution** - Given an eligible mechanic booking is found, when the cron processes it, then `autoDispatchBooking(booking.id)` is called and the booking transitions to `status = "dispatched"` with a `providerId` assigned.

4. **Idempotency** - Given a mechanic booking has already been dispatched (`providerId` is set and `status = "dispatched"`), when the cron fires again, then the booking is NOT re-dispatched (the query excludes it automatically).

5. **Category filtering** - Given the cron query returns confirmed bookings within the 2-hour window, when processing results, then only bookings whose associated service has `category = "mechanics"` are dispatched.

6. **Failed dispatch logging** - Given no provider is available for a mechanic booking, when dispatch fails, then the failure is logged via `logger.error` and an admin notification is triggered.

## Tasks / Subtasks

- [ ] Task 1: Add mechanic pre-dispatch cron job (AC: #1, #2, #3, #5)
  - [ ] 1.1 Add a new entry to the `jobs` array in `server/cron.ts` with `name: "mechanic-pre-dispatch"` and `intervalMs: 15 * 60 * 1000` (15 minutes)
  - [ ] 1.2 In the job's `run` function, query `bookings` where `status = "confirmed"`, `providerId IS NULL`, `scheduledAt >= now`, and `scheduledAt <= now + 2 hours`
  - [ ] 1.3 Join/load the associated service to filter by `category === "mechanics"`
  - [ ] 1.4 For each eligible booking, call `autoDispatchBooking(booking.id)` with error logging per the fire-and-forget pattern

- [ ] Task 2: Ensure idempotency (AC: #4)
  - [ ] 2.1 Verify the query condition `isNull(bookings.providerId)` excludes already-dispatched bookings
  - [ ] 2.2 Verify `autoDispatchBooking()` sets `providerId` and `status = "dispatched"` atomically, preventing double-dispatch

- [ ] Task 3: Failed dispatch handling (AC: #6)
  - [ ] 3.1 Log dispatch failures with `logger.error("[Mechanic Dispatch] Failed for booking ${booking.id}: ...")`
  - [ ] 3.2 If `autoDispatchBooking` returns `{ success: false }`, broadcast admin notification via `broadcastToAdmins()` with dispatch failure details

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** The cron system already exists in `server/cron.ts` using a custom `setInterval`-based pattern (NOT node-cron). Follow the existing pattern exactly.

**Existing dispatch function does the heavy lifting.** `autoDispatchBooking()` already handles specialty matching via the `specialties` JSONB array, radius expansion, dispatch log creation, provider notification, and WebSocket broadcasts. The cron job only needs to find eligible bookings and call the function.

**Fire-and-forget per booking.** Each dispatch call is independent. One failure must not block others. Use `.catch()` per booking.

### Existing Code You MUST Understand

**Cron job pattern** -- `server/cron.ts` (lines 23-72):
```typescript
const HOUR = 60 * 60 * 1000;

const jobs: CronJob[] = [
  {
    name: "reconcile-checkr",
    intervalMs: 1 * HOUR,
    run: async () => {
      const { reconcileCheckrStatuses } = await import("./api/lib/reconciliation");
      return reconcileCheckrStatuses();
    },
  },
  // ... more jobs
];
```
Follow this exact pattern: dynamic `import()` inside `run`, return the result.

**Auto-dispatch function** -- `server/api/lib/auto-dispatch.ts` (lines 30-33):
```typescript
export async function autoDispatchBooking(
  bookingId: string,
  options?: DispatchOptions
): Promise<DispatchResult> {
```
Returns `{ success: boolean; providerId?: string; reason?: string; ... }`. Already handles:
- Provider specialty matching via `specialties` array (line 88): `specialties.includes(service.category)`
- Setting `providerId` and `status = "dispatched"` (lines 134-141)
- Dispatch log creation (lines 150-157)
- Provider notification (line 171)
- WebSocket broadcasts to admin and customer (lines 186-189)

**Broadcast to admins** -- import from `@/server/websocket/broadcast`:
```typescript
broadcastToAdmins({ type: "booking:dispatch_failed", data: { bookingId, reason } });
```

### Exact Implementation

Add this entry to the `jobs` array in `server/cron.ts`:

```typescript
{
  name: "mechanic-pre-dispatch",
  intervalMs: 15 * 60 * 1000, // 15 minutes
  run: async () => {
    const { db } = await import("@/db");
    const { bookings, services } = await import("@/db/schema");
    const { eq, and, isNull, gte, lte } = await import("drizzle-orm");
    const { autoDispatchBooking } = await import("./api/lib/auto-dispatch");
    const { broadcastToAdmins } = await import("./websocket/broadcast");

    const now = new Date();
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const pendingBookings = await db.query.bookings.findMany({
      where: and(
        eq(bookings.status, "confirmed"),
        isNull(bookings.providerId),
        gte(bookings.scheduledAt, now),
        lte(bookings.scheduledAt, twoHoursFromNow),
      ),
      with: { service: true },
    });

    const mechanicBookings = pendingBookings.filter(
      (b) => b.service?.category === "mechanics"
    );

    let dispatched = 0;
    let failed = 0;

    for (const booking of mechanicBookings) {
      const result = await autoDispatchBooking(booking.id).catch((err) => {
        logger.error(`[Mechanic Dispatch] Failed for booking ${booking.id}:`, err);
        return { success: false, reason: String(err) };
      });

      if (result.success) {
        dispatched++;
      } else {
        failed++;
        broadcastToAdmins({
          type: "booking:dispatch_failed",
          data: { bookingId: booking.id, reason: result.reason },
        });
      }
    }

    return { scanned: pendingBookings.length, mechanicEligible: mechanicBookings.length, dispatched, failed };
  },
},
```

### Project Structure Notes

**Files to MODIFY:**

| File | What to Add |
|---|---|
| `server/cron.ts` | New `mechanic-pre-dispatch` job entry in `jobs` array |

**Files NOT to create:**
- NO new cron file -- add to existing `server/cron.ts`
- NO new dispatch function -- use existing `autoDispatchBooking()`
- NO scheduler library -- use existing `setInterval` pattern

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Install `node-cron` or similar | Use existing `setInterval`-based pattern in `server/cron.ts` |
| Create a new dispatch function | Call existing `autoDispatchBooking()` |
| Use top-level imports in cron job | Use dynamic `import()` inside `run` function (existing pattern) |
| Let one dispatch failure stop the loop | `.catch()` per booking, continue processing |
| Query without `isNull(bookings.providerId)` | Always include to ensure idempotency |

### Dependencies and Scope

**This story depends on:** Story 17.1 (scheduledAt enforcement), Epic 16 (services with `category = "mechanics"`)

**This story does NOT include:**
- Modifying auto-dispatch logic (existing function works)
- Provider-side job acceptance flow (Epic 18)
- Manual admin dispatch fallback (existing admin route handles this)

### Testing Guidance

Verify manually:
1. Create a mechanic booking with `scheduledAt` 1.5 hours from now, status `confirmed`, no `providerId`
2. Trigger the cron job -- booking should get dispatched
3. Run cron again -- booking should NOT be re-dispatched (idempotent)
4. Create a roadside booking with same conditions -- should NOT be dispatched by this cron (category filter)
5. Create a mechanic booking with `scheduledAt` 4 hours from now -- should NOT be dispatched (outside 2hr window)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 17, Story 17.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 5: Mechanic Dispatch -- Cron-Based Pre-Dispatch]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-3.1, FR-3.2, FR-3.3, FR-3.4]
- [Source: server/cron.ts - Existing cron job pattern]
- [Source: server/api/lib/auto-dispatch.ts - Existing dispatch function with specialty matching]

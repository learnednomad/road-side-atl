# Story 4.5: Real-Time Provider Tracking

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Epic: 4 - Enhanced Booking Experience -->
<!-- Story Key: 4-5-real-time-provider-tracking -->
<!-- Created: 2026-02-18 -->
<!-- Integration FRs: FR26 (real-time tracking on live map), FR27 (provider name/photo/rating/ETA), FR28 (GPS broadcast during active bookings), FR29 (automated delay notifications) -->
<!-- NFRs: NFR9 (GPS < 500ms latency), NFR19 (no background tracking, no retention beyond booking), NFR8 (WebSocket reconnect < 3s) -->
<!-- Dependencies: Story 4.4 (location detection & provider dispatch) - DONE -->

## Story

As a customer,
I want to track the dispatched provider's location in real-time on a live map,
so that I know exactly when help will arrive.

## Acceptance Criteria

1. **Real-Time Location on Live Map** — Given I have an active booking with a dispatched provider, when the provider's GPS updates, then I see real-time location updates on the live map with < 500ms delivery latency (NFR9, FR26), and I can view the provider's name, photo, rating, and estimated time of arrival (FR27).

2. **GPS Broadcast Scoped to Active Bookings** — Given the provider is en route, when GPS position updates are broadcast, then broadcasts only occur during active bookings (status `dispatched` or `in_progress`) — no background tracking, no GPS data retention beyond booking lifecycle (NFR19, FR28).

3. **WebSocket Reconnection** — Given the WebSocket connection drops (mobile network switch), when the connection is re-established, then reconnection completes in < 3 seconds with exponential backoff and jitter (NFR8), and the provider's current position is immediately displayed from the server-side stored location.

4. **Automated Delay Notification** — Given the provider's ETA exceeds the configurable threshold, when the delay is detected, then an automated delay notification is sent to the customer via SMS (FR29).

## Tasks / Subtasks

- [ ] Task 1: Route provider GPS broadcasts to customer tracking page (AC: #1, #2)
  - [ ] 1.1 In `server/api/routes/provider.ts`, in the `POST /location` handler (after the existing `broadcastToAdmins` call at ~line 285), query active bookings for this provider: `bookings.providerId === provider.id AND bookings.status IN ('dispatched', 'in_progress')`
  - [ ] 1.2 For each active booking found, call `broadcastToUser(booking.id, { type: "provider:location_updated", data: { providerId: provider.id, lat: latitude, lng: longitude } })` — the tracking page registers with `userId: booking.id` as the WS key
  - [ ] 1.3 Import `bookings` schema and `inArray` from drizzle-orm if not already imported
  - [ ] 1.4 Verify existing `broadcastToUser` import from `@/server/websocket/connections`

- [ ] Task 2: Add ETA calculation and include in tracking broadcasts (AC: #1)
  - [ ] 2.1 Create `server/api/lib/eta-calculator.ts` with a `calculateEtaMinutes(providerLat, providerLng, destLat, destLng)` function using Haversine distance from `@/lib/distance` and `AVERAGE_DRIVING_SPEED_MPH` constant
  - [ ] 2.2 In `lib/constants.ts`, add `AVERAGE_DRIVING_SPEED_MPH = 35` and `ETA_DELAY_THRESHOLD_MINUTES = 15`
  - [ ] 2.3 In the `POST /location` handler (Task 1), extract booking pickup coordinates from `booking.location` JSONB, calculate ETA, and include `etaMinutes` in the broadcast payload: `{ providerId, lat, lng, etaMinutes }`
  - [ ] 2.4 Update `server/websocket/types.ts` — add `etaMinutes?: number` to the `provider:location_updated` event data type

- [ ] Task 3: Display ETA and provider details on tracking page (AC: #1)
  - [ ] 3.1 In `app/(marketing)/track/[id]/tracking-client.tsx`, update the `provider:location_updated` handler (~line 72) to also extract `etaMinutes` from the event data and store in state
  - [ ] 3.2 Display ETA prominently in the provider info card section (~line 190-215) — show "Estimated arrival: X minutes" when ETA is available, update dynamically with each GPS broadcast
  - [ ] 3.3 Verify the provider info card already shows provider name; add provider `rating` display if not already present (FR27 requires name, photo, rating, ETA)
  - [ ] 3.4 In `app/(marketing)/track/[id]/page.tsx` (server component), ensure provider `rating` and `photoUrl` are queried and passed to TrackingClient

- [ ] Task 4: Implement automated delay notification (AC: #4)
  - [ ] 4.1 In the `POST /location` handler, after calculating ETA, check if `etaMinutes > ETA_DELAY_THRESHOLD_MINUTES`
  - [ ] 4.2 Track whether a delay notification has already been sent for this booking — use a simple in-memory Set or check a flag. To keep it stateless, add `delayNotificationSent` (boolean, default false) column to bookings table OR use a lightweight check (e.g., only send once per booking by checking if booking has a delay notification audit entry)
  - [ ] 4.3 If delay threshold exceeded and not already notified: send SMS to customer via `sendDelayNotificationSMS(phone, providerName, etaMinutes)` — fire-and-forget `.catch(() => {})`
  - [ ] 4.4 In `lib/notifications/sms.ts`, add `sendDelayNotificationSMS(phone, providerName, etaMinutes)` function with message: `"Your provider ${providerName} is running a bit late. Updated ETA: ${etaMinutes} minutes. Track live: ${baseUrl}/track/${bookingId}"`
  - [ ] 4.5 Log audit entry with action `booking.delay_notification` to prevent duplicate sends and maintain audit trail
  - [ ] 4.6 Add `booking.delay_notification` to `AuditAction` type union in `server/api/lib/audit-logger.ts`

- [ ] Task 5: Clear provider GPS data on booking completion (AC: #2, NFR19)
  - [ ] 5.1 In `server/api/routes/provider.ts`, in the status update handler where booking transitions to `completed`, add: `await db.update(providers).set({ currentLocation: null, lastLocationUpdate: null, updatedAt: new Date() }).where(eq(providers.id, booking.providerId))`
  - [ ] 5.2 Verify the same cleanup happens when booking is cancelled — check both provider.ts and bookings.ts cancel handlers
  - [ ] 5.3 In the `POST /location` handler, if no active booking exists for this provider, still accept the request (return `{ success: true }`) but skip DB persistence and broadcasting — provider app should not error

- [ ] Task 6: Add tracking URL to dispatched status SMS (AC: #1)
  - [ ] 6.1 In `lib/notifications/sms.ts`, modify `sendStatusUpdateSMS` — when status is `dispatched`, append tracking URL: `"Track live: ${process.env.NEXT_PUBLIC_BASE_URL}/track/${bookingId}"`
  - [ ] 6.2 Update the function signature or caller to pass `bookingId` if not already available

- [ ] Task 7: WebSocket reconnection verification (AC: #3)
  - [ ] 7.1 Verify `lib/hooks/use-websocket.ts` already implements exponential backoff: `Math.min(1000 * 2^retries, 30_000)` — confirm this achieves < 3s reconnection on first retry (base delay ~1s, which satisfies NFR8)
  - [ ] 7.2 In `tracking-client.tsx`, verify that on reconnection the tracking page receives the provider's last known position from the server component's initial data (passed as `initialProvider.currentLocation`) — this ensures immediate display on reconnect
  - [ ] 7.3 If reconnection takes > 3s (e.g., retry count > 1), show a "Reconnecting..." indicator on the tracking page

- [ ] Task 8: TypeScript compilation check (AC: all)
  - [ ] 8.1 Run `npx tsc --noEmit` — zero errors required

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** Read `_bmad-output/project-context.md` before writing any code — 127 rules are mandatory.

**The tracking infrastructure is ~85% pre-built.** Do NOT create new tracking pages, map components, or WebSocket infrastructure. The following already exist and are fully functional:

| Component | File | Status |
|---|---|---|
| Tracking page (server) | `app/(marketing)/track/[id]/page.tsx` | EXISTS, complete |
| Tracking page (client) | `app/(marketing)/track/[id]/tracking-client.tsx` | EXISTS, 318 lines |
| Live tracking map | `components/maps/live-tracking-map.tsx` | EXISTS, 145 lines |
| WebSocket hook | `lib/hooks/use-websocket.ts` | EXISTS, complete with reconnect |
| WebSocket server | `server/websocket/server.ts` | EXISTS, auth + heartbeat |
| Connection manager | `server/websocket/connections.ts` | EXISTS, 3 broadcast functions |
| Location tracker | `components/provider/location-tracker.tsx` | EXISTS, 30s GPS polling |
| Google Maps loader | `lib/hooks/use-google-maps.ts` | EXISTS, loads places + marker |
| "Track Live" button | `my-bookings-client.tsx` line 313 | EXISTS |
| "Track Booking" button | `confirmation/page.tsx` line 131 | EXISTS |

**No test framework installed.** Do NOT create test files.

**Integer math for money.** All money values in cents. Commission rates in basis points.

**Zod v4 import.** Always `import { z } from "zod/v4"` — NOT `"zod"`.

**Fire-and-forget for notifications.** Always `.catch(() => {})` — never await notification or broadcast calls.

### THE ONE CRITICAL GAP — Provider GPS Not Routed to Customer

The `POST /location` endpoint in `server/api/routes/provider.ts` (~line 282) broadcasts GPS updates to **admins only**:

```typescript
// CURRENT CODE (provider.ts ~line 282):
broadcastToAdmins({
  type: "provider:location_updated",
  data: { providerId: provider.id, lat: latitude, lng: longitude },
});
// ❌ MISSING: No broadcast to customer tracking page
```

The tracking page at `tracking-client.tsx` (line 72-76) already handles this event correctly:

```typescript
// EXISTING CLIENT CODE (tracking-client.tsx ~line 72):
if (lastEvent.type === "provider:location_updated") {
  const data = lastEvent.data as { providerId: string; lat: number; lng: number };
  if (initialProvider && data.providerId === initialProvider.id) {
    setProviderLocation({ lat: data.lat, lng: data.lng, updatedAt: new Date().toISOString() });
  }
}
```

But the tracking page connects with `userId: booking.id` (not the customer's user ID):
```typescript
// tracking-client.tsx line 59:
const { lastEvent, isConnected } = useWebSocket({ userId: booking.id, role: "tracking", enabled: true });
```

**THE FIX**: After `broadcastToAdmins`, query active bookings for this provider and call `broadcastToUser(booking.id, event)` for each. The `broadcastToUser` function accepts any string key and will match the tracking page's connection registered with the booking ID.

```typescript
// ADD THIS after broadcastToAdmins in provider.ts /location handler:
const activeBookings = await db.query.bookings.findMany({
  where: and(
    eq(bookings.providerId, provider.id),
    inArray(bookings.status, ["dispatched", "in_progress"])
  ),
});
for (const activeBooking of activeBookings) {
  broadcastToUser(activeBooking.id, {
    type: "provider:location_updated",
    data: { providerId: provider.id, lat: latitude, lng: longitude, etaMinutes },
  });
}
```

### Existing WebSocket Architecture You MUST Understand

**Connection model (`server/websocket/connections.ts`):**
- `Map<string, Set<ConnectionInfo>>` — key is userId (or booking.id for tracking pages)
- `broadcastToAdmins(event)` — sends to all connections with `role === "admin"`
- `broadcastToProvider(userId, event)` — sends to connections matching userId
- `broadcastToUser(userId, event)` — sends to connections matching userId (**this is how you reach the tracking page** — the tracking page registers with `userId: booking.id`)

**Auth handshake (`server/websocket/server.ts`):**
- Client sends `{ type: "auth", userId, role }` within 10 seconds
- Server calls `addConnection(userId, role, ws)` and replies `{ type: "auth:success" }`
- 30-second ping heartbeat per socket

**Provider location tracker (`components/provider/location-tracker.tsx`):**
- Uses `navigator.geolocation.getCurrentPosition()` (not `watchPosition`)
- `setInterval` every 30 seconds — polls GPS, POSTs to `/api/provider/location`
- Already mounted on `app/(provider)/provider/page.tsx` and `app/(provider)/provider/jobs/[id]/page.tsx`
- Provider must manually enable tracking (toggle button)

**WebSocket client hook (`lib/hooks/use-websocket.ts`):**
- Connects to `${protocol}//${window.location.host}/ws`
- Sends auth message on open
- Exponential backoff: `Math.min(1000 * 2^retries, 30_000)` — first retry at ~1s (satisfies NFR8 < 3s)
- Returns `{ lastEvent, isConnected, send }`

### LiveTrackingMap Component (`components/maps/live-tracking-map.tsx`)

Already complete with:
- `AdvancedMarkerElement` (not deprecated `Marker`) with custom HTML pins
- Blue dot for pickup, green dot for destination, orange truck for provider
- Provider name label on marker
- `useEffect` watching `providerLocation` prop — updates marker position directly (no re-render)
- Auto-fits bounds on every provider location update
- Loading skeleton and error fallback

**Props:** `pickupLocation`, `destinationLocation?`, `providerLocation?`, `providerName?`, `className?`

### Tracking Page (`tracking-client.tsx`) — What Already Works

This 318-line component includes:
- Status progress stepper (pending → confirmed → dispatched → in_progress → completed)
- Status banner with color-coded icon
- `LiveTrackingMap` rendering when coordinates available
- Real-time WS event handler for `provider:location_updated` (just needs the server to actually send events to it)
- Provider info card with name and phone call button
- Vehicle info, location/destination cards, booking details
- Post-completion review form

### Provider Schema Location Fields (`db/schema/providers.ts`)

- `currentLocation: jsonb("currentLocation").$type<{ lat: number; lng: number; updatedAt: string }>()` — live GPS
- `lastLocationUpdate: timestamp("lastLocationUpdate", { mode: "date" })` — indexed timestamp
- `latitude: real("latitude")` / `longitude: real("longitude")` — static home/base location (used by dispatch, NOT tracking)

### Booking Location JSONB Structure (`db/schema/bookings.ts`)

```typescript
location: jsonb("location").$type<{
  address: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  notes?: string;
  destination?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  estimatedMiles?: number;
}>()
```

Use `booking.location.latitude` and `booking.location.longitude` as the destination for ETA calculation.

### Notification Infrastructure

**Existing dispatched SMS (`lib/notifications/sms.ts` ~line 106):**
- Status "dispatched" maps to message: `"dispatched - provider is on the way"`
- Does NOT include tracking URL — add it in Task 6

**Pattern for new SMS function:**
```typescript
export async function sendDelayNotificationSMS(phone: string, providerName: string, etaMinutes: number, trackingUrl: string) {
  return sendSMS(phone, `Your provider ${providerName} is running late. Updated ETA: ~${etaMinutes} min. Track live: ${trackingUrl}`);
}
```

### Previous Story Learnings (Story 4.4)

- Fire-and-forget: `.catch(() => {})` for notifications/broadcasts, `.catch(() => null)` for dispatch
- `updatedAt: new Date()` in every `.update().set()` call
- `const [result] = await db.insert(...).returning()` destructure pattern
- The `activeProviders` query returns full provider records — no additional DB query needed for provider fields
- Auto-dispatch only runs when `AUTO_DISPATCH_ENABLED=true` env var is set
- Provider specialties must match service category for dispatch sorting
- AbortController pattern for useEffect fetches

### Gotchas

1. **Tracking page uses `booking.id` as WS key, not `booking.userId`** — This is intentional to support guest bookings (where `userId` is null). Always broadcast to `booking.id`, not the customer's account ID.

2. **Provider location is 30-second polling, not continuous** — `LocationTracker` uses `setInterval` + `getCurrentPosition`, not `watchPosition`. This means map updates arrive every ~30 seconds. The `LiveTrackingMap` directly updates the marker position (no animation needed at this frequency).

3. **No `google.maps.Marker` in LiveTrackingMap** — Uses `AdvancedMarkerElement` (newer API). Direct position update via `markerRef.current.position = { lat, lng }`.

4. **ETA is Haversine-based, not Google Directions API** — Use `calculateDistance()` from `lib/distance.ts` (returns miles) with `AVERAGE_DRIVING_SPEED_MPH` constant for a simple, free, instant calculation. Google Distance Matrix API is not needed at Phase 1 volume.

5. **`booking.location` is JSONB** — Access coordinates via `booking.location?.latitude` and `booking.location?.longitude`. These may be null if geocoding failed.

6. **Status "in_progress" in DB** — The booking status enum uses `in_progress` (underscore), not `inProgress` (camelCase). Always use the enum value.

7. **Delay notification should only fire once per booking** — Use `logAudit()` check or a booking flag to prevent duplicate SMS on every 30-second location update.

### Project Structure Notes

- **Primary change**: `server/api/routes/provider.ts` — add GPS broadcast to customer + delay notification + location cleanup
- **New file**: `server/api/lib/eta-calculator.ts` — ETA calculation utility
- **Modify**: `lib/constants.ts` — add ETA constants
- **Modify**: `lib/notifications/sms.ts` — add delay notification SMS + tracking URL to dispatched SMS
- **Modify**: `server/api/lib/audit-logger.ts` — add `booking.delay_notification` action
- **Modify**: `server/websocket/types.ts` — add `etaMinutes` to location event data
- **Modify**: `app/(marketing)/track/[id]/tracking-client.tsx` — display ETA, handle etaMinutes in event
- **Modify**: `app/(marketing)/track/[id]/page.tsx` — ensure provider rating/photo passed to client
- **No new pages** — tracking page already exists
- **No new map components** — LiveTrackingMap already exists
- **No schema changes** — all needed columns exist

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.5: Real-Time Provider Tracking]
- [Source: server/api/routes/provider.ts — lines 255-288 (location endpoint, THE CRITICAL GAP)]
- [Source: app/(marketing)/track/[id]/tracking-client.tsx — 318 lines (tracking page client component)]
- [Source: app/(marketing)/track/[id]/page.tsx — server component loading booking/provider data]
- [Source: components/maps/live-tracking-map.tsx — 145 lines (live map with AdvancedMarkerElement)]
- [Source: lib/hooks/use-websocket.ts — WebSocket hook with reconnect]
- [Source: server/websocket/connections.ts — broadcastToUser/broadcastToAdmins functions]
- [Source: server/websocket/server.ts — auth handshake + heartbeat]
- [Source: server/websocket/types.ts — provider:location_updated event type]
- [Source: components/provider/location-tracker.tsx — 30s GPS polling component]
- [Source: lib/hooks/use-google-maps.ts — Google Maps loader]
- [Source: lib/notifications/sms.ts — SMS infrastructure]
- [Source: lib/notifications/index.ts — notification orchestrator]
- [Source: lib/distance.ts — Haversine distance calculation]
- [Source: lib/constants.ts — project constants]
- [Source: db/schema/providers.ts — currentLocation JSONB field]
- [Source: db/schema/bookings.ts — location JSONB, status enum, providerId]
- [Source: _bmad-output/project-context.md — 127 mandatory rules]
- [Source: _bmad-output/implementation-artifacts/4-4-location-detection-and-provider-dispatch.md — previous story learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- GPS broadcasts now routed to customer tracking pages via broadcastToUser(booking.id)
- ETA calculated using Haversine distance at 35 MPH average
- Delay notifications sent once per booking when ETA exceeds 15 min threshold
- Provider GPS cleared on booking completion/cancellation (both provider and admin routes)
- Admin GPS visibility preserved for idle providers (always persists + broadcasts to admins)
- Reconnecting indicator shown when WebSocket disconnects during active tracking

### File List

- server/api/routes/provider.ts — GPS broadcast to customers, ETA, delay notification, GPS cleanup
- server/api/routes/admin.ts — GPS cleanup on admin-initiated completion/cancellation
- server/api/lib/eta-calculator.ts — NEW: Haversine-based ETA calculation utility
- server/api/lib/delay-tracker.ts — NEW: Shared delay notification dedup tracking
- server/websocket/types.ts — Added etaMinutes to provider:location_updated event
- lib/constants.ts — Added AVERAGE_DRIVING_SPEED_MPH, ETA_DELAY_THRESHOLD_MINUTES
- lib/notifications/sms.ts — Added sendDelayNotificationSMS, tracking URL in dispatched SMS
- server/api/lib/audit-logger.ts — Added booking.delay_notification action
- app/(marketing)/track/[id]/tracking-client.tsx — ETA display, provider rating/photo, reconnecting indicator
- app/(marketing)/track/[id]/page.tsx — Pass provider rating and photoUrl to client

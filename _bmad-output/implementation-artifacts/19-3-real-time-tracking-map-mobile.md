# Story 19.3: Real-Time Tracking Map (Mobile)

Status: backlog

## Story

As a customer with an active booking,
I want to see my provider's location on a real-time map,
so that I know when they are approaching and can be ready for their arrival.

## Acceptance Criteria

1. **Map Renders on Active Booking** - Given the customer opens a booking detail screen with status `dispatched` or `in_progress`, when the screen loads, then a map is displayed showing the provider's live location as a marker.

2. **Provider Location Updates** - Given the tracking map is visible, when the provider's GPS position changes, then the marker moves to the new position within 2 seconds of the update arriving.

3. **Customer Location Shown** - Given the booking has a location with latitude/longitude, when the map renders, then the customer's service location is shown as a distinct pin/marker on the map.

4. **Map Not Shown for Inactive Bookings** - Given the booking status is `pending`, `confirmed`, `completed`, or `cancelled`, when the booking detail screen renders, then the tracking map component is not displayed.

5. **Graceful Fallback** - Given the provider has no location data available, when the map attempts to render, then a message "Waiting for provider location..." is displayed instead of an empty map.

6. **Route Line (Optional)** - Given both provider and customer locations are known, when the map renders, then the map view fits both markers in the viewport with appropriate padding.

## Tasks / Subtasks

- [ ] Task 1: Install mapping dependencies (AC: #1)
  - [ ] 1.1 Install `react-native-maps` and configure for Expo (ensure `expo-location` is also available)
  - [ ] 1.2 Add Google Maps API key to app config for Android (iOS uses Apple Maps by default)

- [ ] Task 2: Create TrackingMap component (AC: #1, #2, #3, #5)
  - [ ] 2.1 Create `src/components/tracking-map.tsx`
  - [ ] 2.2 Accept props: `providerLocation: { latitude: number; longitude: number } | null`, `customerLocation: { latitude: number; longitude: number } | null`, `providerName?: string`
  - [ ] 2.3 Render `MapView` with provider marker (custom icon or default red) and customer marker (blue pin)
  - [ ] 2.4 When `providerLocation` is null, show "Waiting for provider location..." placeholder
  - [ ] 2.5 Use `fitToCoordinates` to auto-zoom when both markers are present (AC: #6)

- [ ] Task 3: Create provider location polling hook (AC: #2)
  - [ ] 3.1 Create `src/features/bookings/use-provider-location.ts` hook
  - [ ] 3.2 Poll `GET /api/provider/location?bookingId=<id>` every 5 seconds using React Query with `refetchInterval: 5000`
  - [ ] 3.3 Return `{ latitude, longitude, updatedAt }` or null
  - [ ] 3.4 Stop polling when booking status changes away from `dispatched`/`in_progress`

- [ ] Task 4: Integrate into booking detail screen (AC: #1, #4)
  - [ ] 4.1 In the booking detail screen, conditionally render `<TrackingMap>` when `status === 'dispatched' || status === 'in_progress'`
  - [ ] 4.2 Pass booking location as `customerLocation` and polled data as `providerLocation`
  - [ ] 4.3 Hide the map for all other statuses

- [ ] Task 5: Styling and UX polish (AC: #1)
  - [ ] 5.1 Map container: `h-64 rounded-xl overflow-hidden` with NativeWind
  - [ ] 5.2 Provider marker shows provider name in callout tooltip
  - [ ] 5.3 Add a subtle loading shimmer while map tiles load

## Dev Notes

### Target Repo

**This is a MOBILE APP story.** All work is in `~/WebstormProjects/roadside-atl-mobile`.

### Existing Code Context

**Booking detail screen:** Currently shows booking info (service, status, provider name, etc.) but has no map. The `Booking` type in `src/lib/types.ts` includes `latitude`, `longitude`, `providerName`, and `providerPhone` fields.

**Booking type** (`src/lib/types.ts`):
```typescript
// Relevant fields:
latitude: number | null;
longitude: number | null;
providerName: string | null;
status: string;
```

**API client** (`src/lib/api/client.tsx`): Axios instance with JWT auth. The provider location endpoint will need to be available from the backend (Epic 18 — provider GPS tracking).

### Key Implementation Details

- Use `react-native-maps` (`MapView`, `Marker` from `react-native-maps`). For Expo managed workflow, this requires `expo install react-native-maps`.
- Polling approach is simpler than WebSocket for v1. Use React Query's `refetchInterval` option set to 5000ms.
- The provider location API endpoint (`GET /api/provider/location`) is expected to be implemented in Epic 18 (provider GPS tracking). Coordinate with that story for the exact response shape.
- `fitToCoordinates` method on `MapView` ref auto-zooms to show both markers with padding.

### Mobile Conventions

- **Routing:** Expo Router file-based routing at `src/app/`
- **State:** React Query for server state, Zustand for local state
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **API hooks:** `react-query-kit` with `createQuery` / `createMutation`
- **Stack:** Expo SDK 54, React Native 0.81.5, TypeScript

### Dependencies

- Epic 18, Story 18.3 (provider GPS location tracking and `GET /api/provider/location` endpoint)
- Booking detail screen must exist with status-aware rendering

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 19, Story 19.3]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-6.6, NFR-4]
- [Source: roadside-atl-mobile/src/features/bookings/api.ts]
- [Source: roadside-atl-mobile/src/lib/types.ts]

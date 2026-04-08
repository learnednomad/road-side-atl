# Story 18.5: Provider GPS Tracking (Mobile)

Status: in-progress

> **~45% pre-existing.** `src/lib/location.ts` has background tracking module with `startLocationTracking()`, `stopLocationTracking()`, `requestLocationPermissions()`. Posts to `/provider/location`. Only wired to availability toggle in dashboard.
> **Remaining:** Wire `startLocationTracking()` to job `en_route` status transition in `[id].tsx`. Add auto-stop on last job completion. Change interval from 15s to 30s per spec. Add permission-denied UX for job status transitions.

## Story

As a provider using the mobile app,
I want my GPS location to be automatically shared with the platform while I am on an active job,
so that customers can see my real-time location on the tracking map and dispatchers can monitor service progress.

## Acceptance Criteria

1. **Automatic Tracking Start** - Given a provider sets their status to `en_route` on any job, when the status update succeeds, then background GPS tracking starts automatically, posting location to `POST /api/provider/location` at 30-second intervals.

2. **Automatic Tracking Stop** - Given a provider completes or cancels their last active job, when no more active jobs remain (status `en_route`, `arrived`, or `in_progress`), then background GPS tracking stops automatically.

3. **Manual Toggle** - Given a provider is on the dashboard, when they toggle their availability to "Available", then GPS tracking starts (if not already running). When they toggle to "Unavailable", GPS tracking stops.

4. **Background Operation** - Given the provider app is backgrounded or the screen is off, when GPS tracking is active, then location updates continue posting to the backend, and a persistent notification shows "Sharing your location with the customer" on Android.

5. **Permission Handling** - Given GPS tracking is requested, when the provider has not granted location permissions, then the app requests both foreground and background location permissions. If denied, the app shows an explanation and a link to settings.

6. **Location Accuracy** - Given GPS tracking is active, when a location update fires, then it posts `{ latitude, longitude }` with balanced accuracy (not high-power GPS) and a minimum distance filter of 50 meters to reduce battery drain.

7. **Resilient Posting** - Given a location update fails to POST (network error), when the next update fires, then it simply posts the latest location — no queuing, no retry of stale positions.

## Tasks / Subtasks

- [ ] Task 1: Review and verify existing location module (AC: #4, #6)
  - [ ] 1.1 Verify `src/lib/location.ts` already implements background tracking with `expo-location` + `expo-task-manager`
  - [ ] 1.2 Confirm update interval (currently 15s — should be 30s per spec) and distance interval (50m)
  - [ ] 1.3 Adjust `UPDATE_INTERVAL_MS` from `15_000` to `30_000` if needed per architecture spec

- [ ] Task 2: Auto-start tracking on job status change (AC: #1)
  - [ ] 2.1 In dashboard screen or job detail, after `en_route` status update succeeds, call `startLocationTracking()`
  - [ ] 2.2 Ensure location permissions are requested first via `requestLocationPermissions()`

- [ ] Task 3: Auto-stop tracking on job completion (AC: #2)
  - [ ] 3.1 After `completed` or `cancelled` status update, check if provider has other active jobs
  - [ ] 3.2 If no active jobs remain, call `stopLocationTracking()`
  - [ ] 3.3 Query active jobs via `useProviderJobs({ status: "in_progress" })` or check local state

- [ ] Task 4: Wire availability toggle to tracking (AC: #3)
  - [ ] 4.1 Verify existing dashboard toggle calls `startLocationTracking()` on available and `stopLocationTracking()` on unavailable
  - [ ] 4.2 If not wired, add tracking start/stop to the `useToggleAvailability` success callback

- [ ] Task 5: Permission denied UX (AC: #5)
  - [ ] 5.1 Show `Alert.alert()` with explanation when permission denied
  - [ ] 5.2 Include "Open Settings" button that calls `Linking.openSettings()`
  - [ ] 5.3 Prevent status change to `en_route` if location permission is not granted

## Dev Notes

### MOBILE APP STORY

**This story is implemented in the mobile app repo:**
`~/WebstormProjects/roadside-atl-mobile` (GitHub: `learnednomad/roadside-atl-mobile`)

**Stack:** Expo SDK 54, React Native 0.81.5, TypeScript, NativeWind, React Query, Zustand, MMKV

### Critical Architecture Constraints

**The location tracking module already exists.** `src/lib/location.ts` is fully implemented with `expo-location` + `expo-task-manager` for background location posting. The key work in this story is wiring the existing module to job lifecycle events and the availability toggle.

**Backend endpoint already exists.** `POST /api/provider/location` accepts `{ latitude, longitude }` and updates the provider's location. The existing `useUpdateLocation` mutation in `api.ts` is also already defined.

### Existing Code You MUST Understand

**Location module** — `src/lib/location.ts`:
```typescript
const LOCATION_TASK_NAME = 'roadsideatl-background-location';
const UPDATE_INTERVAL_MS = 15_000;

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  // Posts latest location to /provider/location via client.post()
});

export async function requestLocationPermissions(): Promise<boolean> {
  // Requests foreground + background permissions, returns true if both granted
}

export async function startLocationTracking(): Promise<void> {
  // Starts background location updates (50m distance, balanced accuracy)
}

export async function stopLocationTracking(): Promise<void> {
  // Stops background location updates
}
```

**Dashboard screen** — `src/features/provider/dashboard-screen.tsx`:
Already imports `requestLocationPermissions`, `startLocationTracking`, `stopLocationTracking` from `@/lib/location`. The availability toggle already has some tracking integration.

**API hook** — `src/features/provider/api.ts`:
```typescript
export const useUpdateLocation = createMutation<
  { success: true },
  { latitude: number; longitude: number },
  AxiosError
>({
  mutationFn: async (variables) => {
    const { data } = await client.post('/provider/location', variables);
    return data;
  },
});
```

### Exact Implementation Specifications

**1. Update interval (if needed):**
Change `UPDATE_INTERVAL_MS` from `15_000` to `30_000` in `src/lib/location.ts`:
```typescript
const UPDATE_INTERVAL_MS = 30_000; // 30 seconds per architecture spec
```

**2. Status change tracking trigger (in job action handler):**
```typescript
const handleStatusUpdate = async (jobId: string, newStatus: string) => {
  if (newStatus === "en_route") {
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) {
      Alert.alert(
        "Location Required",
        "Location sharing is required when en route. Please enable location access in Settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
      return; // Don't proceed with status change
    }
    await startLocationTracking();
  }

  updateJobStatus.mutate(
    { id: jobId, status: newStatus },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["provider-jobs"] });
        if (newStatus === "completed" || newStatus === "cancelled") {
          // Check for remaining active jobs
          checkAndStopTracking();
        }
      },
    }
  );
};
```

**3. Check and stop tracking helper:**
```typescript
async function checkAndStopTracking() {
  // If no active jobs, stop tracking
  const activeStatuses = ["en_route", "arrived", "in_progress"];
  const { data: jobs } = await client.get("/provider/jobs?status=in_progress");
  // Also check en_route and arrived
  const hasActive = /* check if any active jobs remain */;
  if (!hasActive) {
    await stopLocationTracking();
  }
}
```

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Rewrite the location module | Use existing `src/lib/location.ts` functions |
| Use high-accuracy GPS | Use `Location.Accuracy.Balanced` (already set) |
| Queue failed location updates | Drop and send latest on next interval |
| Start tracking without permission check | Always call `requestLocationPermissions()` first |
| Leave tracking running after all jobs complete | Auto-stop when no active jobs remain |
| Track when provider is unavailable | Respect availability toggle |

### Dependencies and Scope

**Depends on:** Story 18.4 (job status management must be functional for lifecycle triggers)

**This story does NOT include:**
- Customer-facing tracking map (Story 19.3 in Epic 19)
- Backend location endpoint changes (already exists)
- New API hooks — `useUpdateLocation` already exists in `api.ts`

### Testing Guidance

1. Login as provider on physical device
2. Accept a job and set status to "En Route"
3. Confirm location permission dialog appears (if not already granted)
4. Confirm persistent notification on Android: "Sharing your location with the customer"
5. Check admin dashboard — confirm provider location is updating
6. Background the app — confirm updates continue
7. Complete the job — confirm tracking stops
8. Toggle availability off — confirm tracking stops
9. Deny location permission — confirm alert with settings link

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 18, Story 18.5]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-6.5]
- [Source: roadside-atl-mobile/src/lib/location.ts — Existing location tracking module]
- [Source: roadside-atl-mobile/src/features/provider/api.ts — useUpdateLocation mutation]
- [Source: roadside-atl-mobile/src/features/provider/dashboard-screen.tsx — Existing availability toggle]

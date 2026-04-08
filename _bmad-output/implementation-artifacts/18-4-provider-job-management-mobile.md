# Story 18.4: Provider Job Management (Mobile)

Status: in-progress

> **~40% pre-existing.** `src/app/job/[id].tsx` has accept/reject/start/complete for `dispatched` and `in_progress` statuses only. `api.ts` has `useAcceptJob`, `useRejectJob`, `useStartJob`, `useCompleteJob`.
> **Remaining:** Add `en_route`, `arrived`, `confirmed` status handling with action buttons. Create generic `useUpdateJobStatus` mutation. Add dashboard filter tabs (All/Active/Completed). Fix accept button loading state.

## Story

As a provider using the mobile app,
I want to view my assigned jobs, accept or reject new dispatches, and update job status through the full lifecycle,
so that I can manage all my work from my phone without needing the web dashboard.

## Acceptance Criteria

1. **Job List Display** - Given a provider is logged in on mobile, when they view the dashboard, then they see a list of assigned jobs with service name, customer name, address, scheduled time, vehicle info, and current status badge, sorted by most recent first.

2. **Accept Job** - Given a provider has a dispatched job, when they tap "Accept", then the app calls `PATCH /api/provider/jobs/:id/accept`, the job card updates to show accepted status, and the jobs list refreshes via React Query invalidation.

3. **Reject Job** - Given a provider has a dispatched job, when they tap "Reject" and optionally enters a reason, then the app calls `PATCH /api/provider/jobs/:id/reject` with the reason, and the job is removed from their active list.

4. **Status Flow** - Given a provider has an accepted job, when they update status through the lifecycle (`en_route` -> `arrived` -> `in_progress` -> `completed`), then each status transition calls `PATCH /api/provider/jobs/:id/status` with the new status, and the UI reflects the current status with appropriate action buttons.

5. **Job Detail View** - Given a provider taps on a job card, when the detail view opens, then they see full booking details including: service name, price, vehicle info (year/make/model/color), customer contact (name, phone), location with address, scheduled time, notes, and current status with available actions.

6. **Status-Specific Actions** - Given a job is in a specific status, when the provider views it, then only valid next-status actions are shown:
   - `dispatched` -> Accept / Reject buttons
   - `confirmed`/accepted -> "En Route" button
   - `en_route` -> "Arrived" button
   - `arrived` -> "Start Service" button
   - `in_progress` -> "Complete" button
   - `completed` -> No action buttons (read-only)

7. **Optimistic Updates** - Given a provider taps a status action, when the API call is in flight, then the button shows a loading state and the UI optimistically updates, reverting on error with an alert.

## Tasks / Subtasks

- [ ] Task 1: Enhance job list on dashboard (AC: #1)
  - [ ] 1.1 Update `dashboard-screen.tsx` job cards to show full details (scheduled time, vehicle info, customer name)
  - [ ] 1.2 Add status filter tabs: All / Active / Completed
  - [ ] 1.3 Add pull-to-refresh with React Query `refetch()`

- [ ] Task 2: Add job detail screen (AC: #5)
  - [ ] 2.1 Create job detail view (inline expandable or separate screen at `src/app/provider/job/[id].tsx`)
  - [ ] 2.2 Display all booking fields: service, price, vehicle, customer contact, location, notes, scheduled time
  - [ ] 2.3 Show status badge and action buttons based on current status

- [ ] Task 3: Accept/Reject functionality (AC: #2, #3)
  - [ ] 3.1 Wire "Accept" button to existing `useAcceptJob` mutation from `api.ts`
  - [ ] 3.2 Wire "Reject" button to existing `useRejectJob` mutation with optional reason input (Alert.prompt or modal)
  - [ ] 3.3 Invalidate `provider-jobs` query on success

- [ ] Task 4: Status transition flow (AC: #4, #6)
  - [ ] 4.1 Add `useUpdateJobStatus` mutation to `api.ts` if not already sufficient (existing `useStartJob` and `useCompleteJob` may need extension for `en_route` and `arrived`)
  - [ ] 4.2 Create status action button component that renders correct button based on current status
  - [ ] 4.3 Wire each button to the appropriate API call

- [ ] Task 5: Loading and error states (AC: #7)
  - [ ] 5.1 Add loading spinner to action buttons during mutation
  - [ ] 5.2 Show `Alert.alert()` on API error with retry option
  - [ ] 5.3 Disable button while mutation is pending to prevent double-taps

## Dev Notes

### MOBILE APP STORY

**This story is implemented in the mobile app repo:**
`~/WebstormProjects/roadside-atl-mobile` (GitHub: `learnednomad/roadside-atl-mobile`)

**Stack:** Expo SDK 54, React Native 0.81.5, TypeScript, NativeWind, React Query, Zustand, MMKV

### Critical Architecture Constraints

**Existing API hooks are mostly in place.** The `src/features/provider/api.ts` file already has `useProviderJobs`, `useAcceptJob`, `useRejectJob`, `useStartJob`, `useCompleteJob`, and `useCancelJob`. The main work is wiring these into the UI with proper status-based action rendering.

**Status transitions map to existing backend routes.** The backend `server/api/routes/provider.ts` has:
- `PATCH /provider/jobs/:id/accept`
- `PATCH /provider/jobs/:id/reject`
- `PATCH /provider/jobs/:id/status` (body: `{ status }`)
- `PATCH /provider/jobs/:id/cancel`

### Existing Code You MUST Understand

**Provider API hooks** — `src/features/provider/api.ts`:
```typescript
export const useProviderJobs = createQuery<ProviderJob[], { status?: string; page?: number }, AxiosError>({
  queryKey: ['provider-jobs'],
  fetcher: async (variables) => {
    const params = new URLSearchParams();
    if (variables?.status) params.set('status', variables.status);
    if (variables?.page) params.set('page', String(variables.page));
    const { data } = await client.get(`/provider/jobs?${params.toString()}`);
    return data.jobs ?? data;
  },
});

export const useAcceptJob = createMutation<void, { id: string }, AxiosError>({
  mutationFn: async (variables) => {
    await client.patch(`/provider/jobs/${variables.id}/accept`);
  },
});
```

**Dashboard screen** — `src/features/provider/dashboard-screen.tsx`:
Already has `StatusBadge` component, `StatCard` component, job list rendering, and availability toggle. Extend this rather than rewriting.

**Provider job type** — `src/features/provider/api.ts`:
```typescript
export type ProviderJob = {
  id: string;
  serviceId: string;
  serviceName: string;
  status: 'pending' | 'confirmed' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled';
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  estimatedPrice: number;
  finalPrice: number | null;
  notes: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
};
```

### Exact Implementation Specifications

**1. Status action map:**
```typescript
const STATUS_ACTIONS: Record<string, { label: string; nextStatus: string; variant: string }[]> = {
  dispatched: [
    { label: "Accept", nextStatus: "accept", variant: "primary" },
    { label: "Reject", nextStatus: "reject", variant: "danger" },
  ],
  confirmed: [
    { label: "En Route", nextStatus: "en_route", variant: "primary" },
  ],
  en_route: [
    { label: "Arrived", nextStatus: "arrived", variant: "primary" },
  ],
  arrived: [
    { label: "Start Service", nextStatus: "in_progress", variant: "primary" },
  ],
  in_progress: [
    { label: "Complete", nextStatus: "completed", variant: "success" },
  ],
};
```

**2. Missing mutation — generic status update:**
Add to `src/features/provider/api.ts`:
```typescript
export const useUpdateJobStatus = createMutation<
  void,
  { id: string; status: string },
  AxiosError
>({
  mutationFn: async (variables) => {
    await client.patch(`/provider/jobs/${variables.id}/status`, {
      status: variables.status,
    });
  },
});
```

**3. Query invalidation pattern:**
```typescript
const queryClient = useQueryClient();
const acceptJob = useAcceptJob();

const handleAccept = (jobId: string) => {
  acceptJob.mutate(
    { id: jobId },
    {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['provider-jobs'] }),
      onError: (err) => Alert.alert("Error", "Failed to accept job. Please try again."),
    }
  );
};
```

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Create a separate jobs screen from scratch | Extend existing `dashboard-screen.tsx` |
| Duplicate API hooks that already exist | Reuse `useAcceptJob`, `useRejectJob`, etc. |
| Allow double-tap on action buttons | Disable button while `mutation.isPending` |
| Navigate away after status change | Stay on same screen, invalidate query |
| Hardcode status strings without type safety | Use the `ProviderJob["status"]` type |

### Dependencies and Scope

**Depends on:** Existing provider API routes (already implemented in backend)

**This story does NOT include:**
- GPS tracking (Story 18.5)
- Observation submission (Story 18.6)
- Inspection report submission (Story 18.7)
- Push notification handling (Story 18.3) — but provider will receive push for new jobs once 18.3 is done

### Testing Guidance

1. Login as provider on mobile
2. Have admin dispatch a job to the provider
3. Confirm job appears in dashboard with full details
4. Accept job — confirm status updates
5. Walk through full lifecycle: En Route -> Arrived -> Start Service -> Complete
6. Reject a different job — confirm it disappears from active list
7. Pull to refresh — confirm list updates

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 18, Story 18.4]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-6.3, FR-6.4]
- [Source: roadside-atl-mobile/src/features/provider/api.ts — Existing API hooks]
- [Source: roadside-atl-mobile/src/features/provider/dashboard-screen.tsx — Existing dashboard UI]
- [Source: server/api/routes/provider.ts — Backend job management routes]

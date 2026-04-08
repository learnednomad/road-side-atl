# Story 19.7: Bug Fixes and Performance

Status: backlog

## Story

As a user (customer, provider, or admin) during the open beta,
I want the platform to be stable, performant, and free of critical bugs,
so that I can reliably use the service without crashes, errors, or unacceptable delays.

## Acceptance Criteria

1. **No P0 Bugs Open** - Given the beta period is active, when the team reviews the bug backlog, then zero P0 (critical/blocking) bugs remain open.

2. **Mobile App Crash Rate** - Given the mobile app is in use during beta, when crash metrics are reviewed, then the crash rate is below 1% of sessions.

3. **API Response Times** - Given the backend APIs are handling beta traffic, when response times are measured, then 95th percentile response time is under 500ms for all customer-facing endpoints.

4. **Mobile Cold Start** - Given a user opens the mobile app from a killed state, when the app loads, then the first meaningful paint occurs in under 2 seconds on a mid-range device.

5. **Memory Leaks Resolved** - Given the mobile app has been running for an extended session, when memory usage is checked, then there are no growing memory leaks from polling, WebSocket connections, or map rendering.

6. **Edge Cases Handled** - Given various edge case scenarios are tested (network drops, token expiry, empty states, rapid navigation), when these scenarios occur, then the app handles them gracefully without crashes or unhandled errors.

## Tasks / Subtasks

- [ ] Task 1: Bug triage and fix (AC: #1, #6)
  - [ ] 1.1 Review and categorize all reported bugs from beta testing
  - [ ] 1.2 Fix P0 bugs immediately (crashes, data loss, security issues)
  - [ ] 1.3 Fix P1 bugs (broken flows, incorrect data display)
  - [ ] 1.4 Document P2 bugs for post-beta backlog

- [ ] Task 2: Mobile app performance audit (AC: #2, #4, #5)
  - [ ] 2.1 Profile mobile app startup time — identify slow imports, unnecessary initial renders
  - [ ] 2.2 Audit React Query cache settings — ensure staleTime and cacheTime are appropriate
  - [ ] 2.3 Check for memory leaks in tracking map polling (Story 19.3) — ensure interval clears on unmount
  - [ ] 2.4 Check for memory leaks in push notification listeners — ensure cleanup on unmount
  - [ ] 2.5 Verify image/asset optimization (compressed assets, lazy loading)

- [ ] Task 3: API performance optimization (AC: #3)
  - [ ] 3.1 Identify slow endpoints via server logs or APM
  - [ ] 3.2 Add database indexes for common query patterns (e.g., bookings by userId, services by category)
  - [ ] 3.3 Review N+1 query patterns in booking list and admin endpoints
  - [ ] 3.4 Ensure mechanic dispatch cron completes in under 5 seconds (NFR-1)

- [ ] Task 4: Error handling hardening (AC: #6)
  - [ ] 4.1 Mobile: Verify all API hooks handle network errors gracefully (show retry or error state, not crash)
  - [ ] 4.2 Mobile: Test token expiry flow — 401 interceptor clears token and redirects to login
  - [ ] 4.3 Mobile: Test rapid navigation between screens (no stale state or duplicate requests)
  - [ ] 4.4 Web: Verify admin dashboard handles empty beta data (no beta users, no mechanic bookings)
  - [ ] 4.5 Backend: Ensure all Hono routes return proper error responses (no unhandled promise rejections)

- [ ] Task 5: Cross-platform consistency check (AC: #1)
  - [ ] 5.1 Verify booking flow produces identical results on web and mobile for same inputs
  - [ ] 5.2 Verify referral codes generated on web work when shared and used on mobile (and vice versa)
  - [ ] 5.3 Verify review submissions from mobile appear correctly on web admin dashboard
  - [ ] 5.4 Verify push notifications trigger correctly for bookings created on both web and mobile

## Dev Notes

### Target Repos

**This story spans BOTH repos:**
- **Web/Backend:** `~/WebstormProjects/road-side-atl` (main repo)
- **Mobile:** `~/WebstormProjects/roadside-atl-mobile`

### Existing Code Context

**Mobile API client** (`roadside-atl-mobile/src/lib/api/client.tsx`):
Axios instance with 401 interceptor that calls `removeToken()`. Verify this correctly triggers re-authentication flow.

**Mobile auth store** (`roadside-atl-mobile/src/features/auth/use-auth-store.ts`):
Zustand store with MMKV persistence. Verify token removal triggers navigation to login screen.

**Backend cron** (`server/cron.ts`):
Contains Checkr reconciliation (1h), Stripe Connect (4h), abandonment (6h), deadline (24h). Mechanic pre-dispatch (15min) added in Epic 17. Verify all cron jobs are idempotent and performant.

**Backend middleware:**
- `server/api/middleware/auth.ts` — JWT auth
- `server/api/middleware/rate-limit.ts` — Rate limiting
- Verify rate limits are appropriate for beta traffic volume

### Key Implementation Details

- This is an ongoing story that runs through Sprint 4 (May 19 - Jun 7). It absorbs all bug reports and performance issues from beta testing.
- No specific features are built — this is maintenance, optimization, and stabilization work.
- Track bugs using GitHub Issues with labels: `bug`, `beta`, `P0`/`P1`/`P2`.
- Performance targets from PRD NFRs: cold start <2s (NFR-3), push delivery <3s (NFR-2), map update <2s (NFR-4), cron scan <5s (NFR-1).
- Use React Native Performance Monitor (dev tools) for mobile profiling.
- Use server-side logging for API response time measurement.

### Mobile Conventions

- **Routing:** Expo Router file-based routing at `src/app/`
- **State:** React Query for server state, Zustand + MMKV for local state
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **Stack:** Expo SDK 54, React Native 0.81.5, TypeScript

### Dependencies

- All other Epic 19 stories (19.1-19.6) should be complete before final performance pass
- Beta users actively using the platform to surface real bugs

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 19, Story 19.7]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#NFR-1 through NFR-4]
- [Source: roadside-atl-mobile/src/lib/api/client.tsx — 401 interceptor]
- [Source: server/cron.ts — cron job performance]

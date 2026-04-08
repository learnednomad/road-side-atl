# Story 19.1: Service Category Tabs (Mobile)

Status: backlog

## Story

As a customer using the mobile app,
I want to see services organized under Roadside / Diagnostics / Mechanics tabs,
so that I can quickly browse and select from all available service categories including the new mechanic services.

## Acceptance Criteria

1. **Category Tabs Render** - Given the services screen loads, when the user views the screen, then three horizontal tabs are visible: "Roadside", "Diagnostics", and "Mechanics", with "Roadside" selected by default.

2. **Tab Filtering Works** - Given the user taps the "Mechanics" tab, when the tab becomes active, then only services with `category = "mechanics"` are displayed in the list below.

3. **Scheduled Badge Displayed** - Given a mechanic service is rendered in the list, when the user views the service card, then a "Scheduled" badge is visible on the card indicating the service requires a scheduled appointment.

4. **Category Query Parameter** - Given the user selects a tab, when services are fetched, then the API call uses `GET /api/services?category=<selected>` to fetch only services for that category.

5. **Service Type Extended** - Given the `Service` type in `src/lib/types.ts`, when the app compiles, then the `category` field includes `'mechanics'` and a new `schedulingMode` field (`'immediate' | 'scheduled' | 'both'`) is present.

6. **Navigation to Booking** - Given the user taps a mechanic service card, when navigation fires, then the user is routed to `/book?service=<slug>` with the mechanic service slug.

## Tasks / Subtasks

- [ ] Task 1: Update Service type (AC: #5)
  - [ ] 1.1 Add `'mechanics'` to the `category` union in `src/lib/types.ts`
  - [ ] 1.2 Add `schedulingMode: 'immediate' | 'scheduled' | 'both'` field to `Service` type

- [ ] Task 2: Update services API hook (AC: #4)
  - [ ] 2.1 Add `useServicesByCategory` query hook in `src/features/services/api.ts` that accepts a `category` parameter and calls `GET /api/services?category=<category>`
  - [ ] 2.2 Alternatively, add optional `category` variable to existing `useServices` hook

- [ ] Task 3: Create category tab component (AC: #1)
  - [ ] 3.1 Create `src/features/services/components/category-tabs.tsx` with three tab buttons: Roadside, Diagnostics, Mechanics
  - [ ] 3.2 Use NativeWind for styling: active tab has `bg-red-600 text-white`, inactive has `bg-neutral-100 text-neutral-700`
  - [ ] 3.3 Accept `activeCategory` and `onCategoryChange` props

- [ ] Task 4: Add "Scheduled" badge to ServiceCard (AC: #3)
  - [ ] 4.1 Update `src/features/services/components/service-card.tsx` to accept `schedulingMode` from the service object
  - [ ] 4.2 Render a small "Scheduled" badge (e.g., `bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs`) when `schedulingMode === 'scheduled'`

- [ ] Task 5: Integrate tabs into services screen (AC: #1, #2, #6)
  - [ ] 5.1 Refactor `src/features/services/services-screen.tsx` to use `CategoryTabs` and filter services by selected category
  - [ ] 5.2 Replace hardcoded `roadside`/`diagnostics` sections with a single filtered list under the active tab
  - [ ] 5.3 Maintain existing navigation behavior: `router.push(`/book?service=${service.slug}`)`

## Dev Notes

### Target Repo

**This is a MOBILE APP story.** All work is in `~/WebstormProjects/roadside-atl-mobile`.

### Existing Code Context

**Current services screen** (`src/features/services/services-screen.tsx`):
Currently hardcodes two sections — `roadside` and `diagnostics` — by filtering `services` array client-side. This needs to be replaced with tab-based navigation and per-category fetching.

**Current Service type** (`src/lib/types.ts`):
```typescript
export type Service = {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  pricePerMile: number | null;
  category: 'roadside' | 'diagnostics';  // ADD 'mechanics'
  active: boolean;
};
```

**Current services API** (`src/features/services/api.ts`):
Uses `createQuery` from `react-query-kit`. The `useServices` hook fetches all services without a category filter. Either extend it with a `category` variable or create a new `useServicesByCategory` hook.

**ServiceCard** (`src/features/services/components/service-card.tsx`):
Simple card showing name, description, and price. Needs a `schedulingMode` badge addition.

**API client** (`src/lib/api/client.tsx`):
Axios instance at `${Env.EXPO_PUBLIC_API_URL}/api` with JWT auth interceptor.

### Mobile Conventions

- **Routing:** Expo Router file-based routing at `src/app/`
- **State:** React Query for server state, Zustand for local state
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **API hooks:** `react-query-kit` with `createQuery` / `createMutation`
- **Stack:** Expo SDK 54, React Native 0.81.5, TypeScript

### Backend Dependency

Requires Epic 16 (Story 16.1) to have added `mechanics` to the `service_category` enum and seeded mechanic services. The `GET /api/services?category=` filter must be live.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 19, Story 19.1]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-6.1]
- [Source: roadside-atl-mobile/src/features/services/services-screen.tsx]
- [Source: roadside-atl-mobile/src/features/services/api.ts]
- [Source: roadside-atl-mobile/src/lib/types.ts]

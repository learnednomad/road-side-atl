# Story 19.6: Beta Analytics Dashboard (Admin)

Status: backlog

## Story

As an admin,
I want to see beta user counts, mechanic booking statistics, and conversion metrics on the admin dashboard,
so that I can monitor the health and adoption of the open beta and mechanic services.

## Acceptance Criteria

1. **Beta Stats Section Visible** - Given the admin navigates to the admin dashboard, when the page loads, then a "Beta Analytics" section is displayed below or alongside the existing stats cards.

2. **Beta User Count** - Given there are rows in the `beta_users` table, when the admin views beta analytics, then the total beta user count is displayed accurately.

3. **Mechanic Booking Count** - Given there are bookings with `category = 'mechanics'`, when the admin views beta analytics, then the total mechanic booking count is displayed, broken down by service type (Oil Change, Brake Service, etc.).

4. **Conversion Funnel** - Given beta users have been enrolled, when the admin views beta analytics, then a conversion funnel shows: total beta users -> users with 1+ bookings -> users with 2+ bookings (repeat customers).

5. **Beta Period Context** - Given the beta config exists in `platform_settings`, when the dashboard renders, then the beta start date, end date, and current status (active/inactive) are displayed.

6. **Data Accuracy** - Given the admin views the beta stats, when compared to raw database queries, then all displayed counts match the underlying data.

## Tasks / Subtasks

- [ ] Task 1: Create beta analytics API endpoint (AC: #2, #3, #4, #5)
  - [ ] 1.1 Add `GET /api/admin/beta/stats` route in `server/api/routes/admin.ts` (or new `admin-beta.ts`)
  - [ ] 1.2 Query `beta_users` table for total count
  - [ ] 1.3 Query bookings joined with services where `category = 'mechanics'`, grouped by service slug for breakdown
  - [ ] 1.4 Calculate conversion funnel: total beta users, users with 1+ bookings, users with 2+ bookings
  - [ ] 1.5 Fetch beta config from `platform_settings` (beta_mode_active, beta_start_date, beta_end_date)
  - [ ] 1.6 Return combined response object

- [ ] Task 2: Create BetaStatsCards component (AC: #1, #2, #3, #5)
  - [ ] 2.1 Create `components/admin/beta-stats-cards.tsx`
  - [ ] 2.2 Follow the existing pattern in `components/admin/stats-cards.tsx` — use `Card`, `CardContent`, `CardHeader`, `CardTitle` from `@/components/ui/card`
  - [ ] 2.3 Display cards: "Beta Users" (count + icon), "Mechanic Bookings" (total count), "Beta Status" (active/inactive badge with dates)
  - [ ] 2.4 Use `lucide-react` icons consistent with existing stats cards (e.g., `Users`, `Wrench`, `Activity`)

- [ ] Task 3: Create mechanic booking breakdown table (AC: #3)
  - [ ] 3.1 Create a simple table/list showing each mechanic service name and its booking count
  - [ ] 3.2 Include within the beta analytics section or as an expandable detail under the mechanic bookings card

- [ ] Task 4: Create conversion funnel display (AC: #4)
  - [ ] 4.1 Display funnel as a vertical progression: Total Beta Users -> Active Bookers -> Repeat Customers
  - [ ] 4.2 Show percentage conversion at each step
  - [ ] 4.3 Can use simple bar chart or styled progress bars (follow existing `recharts` usage in stats-cards.tsx)

- [ ] Task 5: Integrate into admin dashboard page (AC: #1, #6)
  - [ ] 5.1 Import and render `BetaStatsCards` in the admin dashboard page
  - [ ] 5.2 Fetch data with `useQuery` or SWR (follow existing admin data fetching pattern)
  - [ ] 5.3 Add loading state with skeleton cards

## Dev Notes

### Target Repo

**This is a WEB story.** All work is in `~/WebstormProjects/road-side-atl` (main repo).

### Existing Code Context

**Stats cards component** (`components/admin/stats-cards.tsx`):
```typescript
interface StatsCardsProps {
  todayBookings: number;
  pendingBookings: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  sparklines?: { bookings: number[]; revenue: number[] };
}
```
Uses `Card`, `CardContent`, `CardHeader`, `CardTitle` from `@/components/ui/card`, `lucide-react` icons, `recharts` for sparklines, and `formatPrice` from `@/lib/utils`. Follow this exact pattern for the beta stats cards.

**Admin routes** (`server/api/routes/admin.ts`):
Hono-based API routes with `requireAuth` middleware and role-based access control. New endpoint should require admin role.

**Audit logger pattern:**
```typescript
const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
logAudit({ action, userId, resourceType, resourceId, details, ipAddress, userAgent });
```

**Database access pattern:**
```typescript
import { db } from "@/db";
import { betaUsers, bookings, services } from "@/db/schema";
import { eq, and, count, sql } from "drizzle-orm";
```

### Key Implementation Details

- The `beta_users` table is created in Epic 16 (Story 16.3). Schema: `id`, `userId`, `enrolledAt`, `source`, `convertedAt`.
- Mechanic bookings are identified by joining `bookings` with `services` where `services.category = 'mechanics'`.
- The conversion funnel is a computed metric: count distinct userIds in `beta_users`, then cross-reference with bookings count per user.
- Beta config lives in `platform_settings` table — read `beta_mode_active`, `beta_start_date`, `beta_end_date` rows.
- Use `recharts` for any charts (already a project dependency, used in `stats-cards.tsx`).
- Formatting: use `formatPrice()` from `@/lib/utils` for any monetary values.

### Dependencies

- Epic 16, Story 16.3 (beta_users table and beta config in platform_settings)
- Epic 17 (mechanic bookings exist in database)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 19, Story 19.6]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-2.8]
- [Source: components/admin/stats-cards.tsx — existing admin stats card pattern]
- [Source: server/api/routes/admin.ts — existing admin route pattern]

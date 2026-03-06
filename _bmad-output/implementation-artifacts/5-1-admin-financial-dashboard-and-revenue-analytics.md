# Story 5.1: Admin Financial Dashboard & Revenue Analytics

Status: done

## Story

As an admin,
I want a comprehensive dashboard showing revenue analytics broken down by source, service category, payment method, and time-block tier,
so that I can answer "is the business working?" at a glance.

## Acceptance Criteria

1. **Given** I am an authenticated admin **When** I navigate to the financial reports page **Then** I see revenue totals with filters for date range, source (B2B/B2C), service category, payment method, and time-block tier **And** charts render using Recharts showing revenue trends over time.

2. **Given** I select a date range filter **When** the dashboard updates **Then** all metrics recalculate for the selected period via real-time PostgreSQL aggregation.

3. **Given** the dashboard displays financial data **When** amounts are shown **Then** all values are returned from the API in cents and formatted on the client using `formatPrice()`.

4. **Given** I view the dashboard **When** I see the overview section **Then** it includes pending payments count, payout queue total, active bookings, and provider availability summary.

## Tasks / Subtasks

- [x] Task 1: Create `financial-reports.ts` API route (AC: #1, #2, #3)
  - [x] 1.1 Create `server/api/routes/financial-reports.ts` with `requireAdmin` middleware
  - [x] 1.2 Add `GET /revenue-breakdown` endpoint — aggregate revenue by source (B2B/B2C via `tenantId`), service category, payment method, and time-block tier with date range params
  - [x] 1.3 Add `GET /overview` endpoint — pending payments count, payout queue total, active bookings count, provider availability count
  - [x] 1.4 Register route in `server/api/index.ts` as `app.route("/admin/financial-reports", financialReportsRoutes)`
- [x] Task 2: Time-block tier revenue aggregation logic (AC: #1, #2)
  - [x] 2.1 In `revenue-breakdown` endpoint, derive time-block tier from booking `createdAt` hour matched against `time_block_configs` table using SQL CASE expression
  - [x] 2.2 Include tier name (Standard, After-Hours, Storm Mode) and revenue grouped by tier
- [x] Task 3: Enhance admin dashboard page (AC: #1, #4)
  - [x] 3.1 Create `components/admin/financial-reports-dashboard.tsx` ("use client") with filter state for date range, source, category, method, tier
  - [x] 3.2 Add KPI cards row: pending payments, payout queue, active bookings, online providers (reuse `stats-cards.tsx` pattern)
  - [x] 3.3 Add revenue trend chart (extend existing `ProfitTrendChart` pattern from `financial-charts.tsx`)
  - [x] 3.4 Add revenue breakdown charts: by service category (BarChart), by payment method (PieChart), by time-block tier (BarChart), by source B2B/B2C (PieChart)
  - [x] 3.5 Create or update `app/(admin)/admin/financial-reports/page.tsx` server component wrapping the client dashboard
- [x] Task 4: Add filter controls (AC: #2)
  - [x] 4.1 Reuse existing `DateRangePicker` from `components/admin/date-range-picker.tsx`
  - [x] 4.2 Add select dropdowns for source (All/B2C/B2B), service category (All/per-service), payment method (All/cash/cashapp/zelle/stripe), time-block tier (All/Standard/After-Hours/Storm Mode)
  - [x] 4.3 Filter state triggers refetch with query params passed to `/admin/financial-reports/revenue-breakdown`
- [x] Task 5: Add CSV export (AC: #1)
  - [x] 5.1 Add `GET /revenue-breakdown/export` endpoint returning CSV with all breakdown dimensions
  - [x] 5.2 Reuse existing `ExportButton` component from `components/admin/export-button.tsx`
- [x] Task 6: Update admin sidebar navigation (AC: #1)
  - [x] 6.1 Add "Financial Reports" link to `components/admin/sidebar.tsx` and `admin-mobile-nav.tsx` with `BarChart3` icon from lucide-react

## Dev Notes

### CRITICAL: What Already Exists (DO NOT Rebuild)

The codebase already has substantial financial analytics. Understand the landscape before writing code:

| Existing File | What It Does | Your Relationship |
|---|---|---|
| `server/api/routes/admin-finances.ts` | KPI summary, aging buckets, monthly trends | **DO NOT duplicate** — your `financial-reports.ts` adds NEW endpoints for multi-dimension breakdowns. Existing endpoints remain untouched. |
| `components/admin/finances-dashboard.tsx` | KPI cards + profit trend + aging chart | **DO NOT touch** — your new dashboard is a SEPARATE page at `/admin/financial-reports` |
| `components/admin/revenue-analytics.tsx` | Date range picker + 3 charts + CSV export | **Reference for patterns** — your page adds the missing B2B/B2C and time-block tier dimensions |
| `components/admin/revenue-charts.tsx` | DailyRevenueChart, ServiceRevenueChart, PaymentMethodChart | **Reuse chart patterns** — follow exact same Recharts + ResponsiveContainer + color scheme |
| `components/admin/financial-charts.tsx` | ProfitTrendChart, AgingChart | **Reference patterns** — follow same styling |
| `components/admin/stats-cards.tsx` | 4-card KPI grid with sparklines | **Reuse pattern** for your overview KPIs |
| `components/admin/date-range-picker.tsx` | Date range with presets (Today, 7d, 30d, 90d) | **Import and reuse directly** |
| `components/admin/export-button.tsx` | CSV download from endpoint | **Import and reuse directly** |

### Time-Block Tier Derivation Strategy

Bookings do NOT store which time-block tier was applied. Derive it in SQL:

```sql
-- Match booking creation hour to active time_block_configs
-- Handle overnight ranges (e.g., After-Hours: startHour=18, endHour=6)
CASE
  WHEN EXISTS (
    SELECT 1 FROM time_block_configs tbc
    WHERE tbc."isActive" = true AND tbc.priority >= 100
  ) THEN 'Storm Mode'  -- Active storm mode overrides all
  WHEN EXTRACT(HOUR FROM bookings."createdAt") >= 18
    OR EXTRACT(HOUR FROM bookings."createdAt") < 6
    THEN 'After-Hours'
  ELSE 'Standard'
END AS time_block_tier
```

**Important**: This is a point-in-time approximation. Storm Mode is only accurate for currently-active storms — historical Storm Mode bookings aren't tagged. Consider adding a `timeBlockTier` text column to bookings in a future story for precise historical tracking. For now, use the hour-based derivation.

### B2B/B2C Source Derivation

The `tenantId` column on bookings distinguishes B2B vs B2C:
- `tenantId IS NULL` → B2C (direct customer)
- `tenantId IS NOT NULL` → B2B (business account)

Since Epic 9 (B2B) is Phase 2 and not yet built, all bookings currently have `tenantId = null`. Build the filter infrastructure now so it works when B2B launches.

### Provider Availability Query

Count online providers from the users table. Providers toggle availability — check for the pattern in existing provider routes. Look at `server/api/routes/provider.ts` for how availability status is tracked. The users table has an `isAvailable` boolean (or similar) for providers.

### Revenue Breakdown Endpoint Design

```
GET /admin/financial-reports/revenue-breakdown?startDate=ISO&endDate=ISO&source=b2c&category=roadside&method=cash&tier=standard
```

Response shape:
```typescript
{
  totals: {
    revenue: number,      // cents
    bookingCount: number,
    avgBookingValue: number, // cents
  },
  bySource: [
    { source: "B2C", revenue: number, count: number },
    { source: "B2B", revenue: number, count: number },
  ],
  byCategory: [
    { category: string, revenue: number, count: number },
  ],
  byMethod: [
    { method: string, revenue: number, count: number },
  ],
  byTier: [
    { tier: string, revenue: number, count: number },
  ],
  dailyTrend: [
    { date: "YYYY-MM-DD", revenue: number, count: number },
  ],
}
```

### SQL Aggregation Pattern (Follow admin-finances.ts)

```typescript
// Use Drizzle's sql template tag for aggregations
const results = await db
  .select({
    category: services.category,
    revenue: sql<number>`coalesce(sum(case when ${payments.status} = 'confirmed' then ${payments.amount} else 0 end), 0)`,
    count: sql<number>`count(case when ${payments.status} = 'confirmed' then 1 end)`,
  })
  .from(payments)
  .innerJoin(bookings, eq(payments.bookingId, bookings.id))
  .innerJoin(services, eq(bookings.serviceId, services.id))
  .where(and(
    sql`${payments.createdAt} >= ${startDate}`,
    sql`${payments.createdAt} <= ${endDate}`,
    // Dynamic filters via .$dynamic() or conditional where clauses
  ))
  .groupBy(services.category);
```

### Recharts Pattern (Follow revenue-charts.tsx exactly)

```typescript
const COLORS = [
  "hsl(var(--chart-1, 220 70% 50%))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
];

// Always wrap in ResponsiveContainer
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={data}>
    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
    <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, ""]} />
    <Bar dataKey="revenue" fill={COLORS[0]} />
  </BarChart>
</ResponsiveContainer>
```

### Project Structure Notes

New files to create:
- `server/api/routes/financial-reports.ts` — NEW route module
- `components/admin/financial-reports-dashboard.tsx` — NEW dashboard client component
- `app/(admin)/admin/financial-reports/page.tsx` — NEW page

Files to modify:
- `server/api/index.ts` — register new route
- `components/admin/sidebar.tsx` — add nav link
- `components/admin/admin-mobile-nav.tsx` — add nav link

Files to REFERENCE (read patterns, do NOT modify):
- `server/api/routes/admin-finances.ts` — SQL aggregation patterns
- `components/admin/revenue-analytics.tsx` — filter + chart layout
- `components/admin/revenue-charts.tsx` — Recharts component patterns
- `components/admin/stats-cards.tsx` — KPI card layout
- `components/admin/date-range-picker.tsx` — date range component (import directly)
- `components/admin/export-button.tsx` — CSV export (import directly)

### Architecture Compliance

- **Route pattern**: `const app = new Hono<AuthEnv>()` → `app.use("/*", requireAdmin)` → define endpoints → `export default app`
- **AuthEnv type**: Declare locally in route file (not imported globally)
- **Money**: All amounts in cents (integer). Format on client via `formatPrice()` from `@/lib/utils`
- **No try-catch**: Hono handles errors. Only safeParse for input validation
- **Import paths**: `@/` alias only, never relative `../`
- **Zod v4**: `import { z } from "zod/v4"` for query param validation
- **Named exports**: `export function FinancialReportsDashboard()` — no default exports for components
- **Manual updatedAt**: N/A (read-only endpoints, no mutations in this story)
- **Rate limiting**: Apply `rateLimitStandard` — these are read-only admin endpoints
- **NFR24**: Database queries must maintain < 100ms response — use proper indexing, avoid N+1

### Previous Story Intelligence

From Epic 3 stories (direct dependency — payment data feeds this dashboard):
- **Effective price resolution**: `priceOverrideCents ?? confirmedPayment.amount` — use this pattern when calculating revenue
- **Payout calculation 3-tier priority**: flat_per_job > service commission > provider commission — your dashboard should reflect the actual payout amounts from `providerPayouts` table, not recalculate
- **Commission context**: Service-level `commissionRate` in basis points exists on services table — useful for commission analytics
- **Route ordering**: Place specific routes (e.g., `/revenue-breakdown/export`) BEFORE parameterized routes

From Epic 4 stories:
- **Fire-and-forget**: N/A for read-only endpoints
- **Guest bookings**: `booking.userId` can be null — handle in user-related aggregations

### Git Intelligence

Recent commit patterns confirm:
- All schemas use text PKs via `createId()`
- Admin routes consistently use `requireAdmin` middleware
- WebSocket broadcasts after mutations (not needed for this read-only story)
- Audit logging for state changes (not needed for read-only endpoints)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5 Story 5.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#6 new API route modules]
- [Source: _bmad-output/project-context.md#Hono API Layer]
- [Source: _bmad-output/project-context.md#Adding New Features Checklist]
- [Source: server/api/routes/admin-finances.ts — SQL aggregation patterns]
- [Source: components/admin/revenue-charts.tsx — Recharts patterns]
- [Source: db/schema/bookings.ts — tenantId for B2B/B2C, createdAt for time-block derivation]
- [Source: db/schema/time-block-configs.ts — time block definitions]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed ESLint `react-hooks/set-state-in-effect` error by using async/try-finally pattern matching existing `revenue-analytics.tsx`
- Removed unused `timeBlockConfigs` import and unused `baseFrom` variable from route file

### Completion Notes List

- Created `financial-reports.ts` API route with `requireAdmin` + `rateLimitStandard` middleware, Zod v4 query param validation
- Implemented `GET /revenue-breakdown` with multi-dimension aggregation: by source (B2B/B2C via tenantId), category, payment method, time-block tier, and daily trend
- Implemented time-block tier derivation via SQL CASE: Storm Mode (priority >= 100), After-Hours (18:00-06:00), Standard (default)
- Implemented `GET /overview` with pending payments, payout queue, active bookings, and online provider counts
- Implemented `GET /revenue-breakdown/export` CSV endpoint (registered before parameterized routes per Dev Notes)
- Created `FinancialReportsDashboard` client component with 4 KPI cards, revenue totals row, LineChart trend, 4 breakdown charts (2 BarChart + 2 PieChart)
- All filter controls (DateRangePicker + 4 Select dropdowns) trigger refetch with query params
- Reused existing `DateRangePicker` and `ExportButton` components directly
- All amounts returned in cents from API, formatted on client via `formatPrice()`
- All architecture compliance rules followed: Hono pattern, AuthEnv local type, `@/` imports, Zod v4, named exports, no try-catch in route handlers
- Added "Financial Reports" nav link with BarChart3 icon to both sidebar and mobile nav
- TypeScript compiles clean, ESLint passes with zero errors/warnings
- Code review fixes: time-block tier derived from `time_block_configs`, revenue uses `priceOverrideCents` when present, booking counts use distinct bookings, chart values formatted via `formatPrice()`, client component renamed to `*-client.tsx`

### Change Log

- 2026-02-18: Implemented Story 5.1 — Admin Financial Dashboard & Revenue Analytics (all 6 tasks, all ACs satisfied)

### File List

New files:
- server/api/routes/financial-reports.ts
- components/admin/financial-reports-dashboard-client.tsx
- app/(admin)/admin/financial-reports/page.tsx

Modified files:
- server/api/index.ts (added route registration)
- components/admin/sidebar.tsx (added Financial Reports nav link + BarChart3 import)
- components/admin/admin-mobile-nav.tsx (added Financial Reports nav link + BarChart3 import)

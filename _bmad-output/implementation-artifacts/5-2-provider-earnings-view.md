# Story 5.2: Provider Earnings View

Status: done

## Story

As a provider,
I want to view my detailed earnings breakdown (per-job, daily, weekly, monthly),
so that I can track my income and plan financially.

## Acceptance Criteria

1. **Given** I am an authenticated provider **When** I navigate to my earnings page **Then** I see per-job earnings with service type, booking amount, commission deducted, and my payout **And** I see aggregated totals for daily, weekly, and monthly periods.

2. **Given** I select a different time period **When** the earnings view updates **Then** the totals recalculate for the selected period.

3. **Given** the earnings page displays amounts **When** values are shown **Then** all values are returned from the API in cents and formatted on the client using `formatPrice()`.

## Tasks / Subtasks

- [x] Task 1: Add daily and weekly aggregation endpoints (AC: #1, #2)
  - [x] 1.1 Add `GET /earnings/daily` endpoint to `server/api/routes/provider.ts` — aggregate by date for last 30 days, return `{ date, earnings, jobCount }[]`
  - [x] 1.2 Add `GET /earnings/weekly` endpoint — aggregate by ISO week for last 12 weeks, return `{ week, weekStart, weekEnd, earnings, jobCount }[]`
  - [x] 1.3 Add `period` query param to existing `GET /earnings/trends` endpoint to support `?period=daily|weekly|monthly` (keep monthly as default for backward compatibility)
- [x] Task 2: Enhance per-job earnings display (AC: #1, #3)
  - [x] 2.1 Extend `GET /earnings/history` response to explicitly include `bookingAmount` (from `payments.amount` or `bookings.finalPrice`) and `commissionDeducted` (calculated: `bookingAmount - payoutAmount`) alongside existing payout amount
  - [x] 2.2 Update `earnings-summary.tsx` payout history table to show columns: Date, Service, Booking Amount, Commission, My Payout, Status
- [x] Task 3: Add period selector to earnings charts (AC: #2)
  - [x] 3.1 Add a segmented toggle (Daily / Weekly / Monthly) above the `MonthlyEarningsChart` in `earnings-summary.tsx`
  - [x] 3.2 Fetch the appropriate trends endpoint based on selected period
  - [x] 3.3 Update `MonthlyEarningsChart` in `earnings-charts.tsx` to accept dynamic data with appropriate X-axis labels (dates for daily, "Week N" for weekly, month names for monthly)
- [x] Task 4: Add period summary KPI cards (AC: #1, #2)
  - [x] 4.1 Add daily and weekly total KPI cards that update when the period selector changes
  - [x] 4.2 Show: Today's Earnings, This Week's Earnings, This Month's Earnings alongside existing totals

## Dev Notes

### CRITICAL: What Already Exists (DO NOT Rebuild)

This story is an ENHANCEMENT of an already-functional provider earnings page. The vast majority of the infrastructure exists.

| Existing File | What It Does | Your Relationship |
|---|---|---|
| `server/api/routes/provider.ts` | 5 earnings endpoints: `/earnings/summary`, `/history`, `/trends`, `/by-service`, `/stats` | **EXTEND** — add daily/weekly endpoints, enhance history response |
| `components/provider/earnings-summary.tsx` | Full earnings page: 4 KPI cards + commission info + charts + payout history table with filtering | **MODIFY** — add period selector, enhance table columns, add period KPIs |
| `components/provider/earnings-charts.tsx` | `MonthlyEarningsChart` (AreaChart) + `ServiceBreakdownChart` (PieChart) | **MODIFY** — make chart accept dynamic period data, update X-axis labels |
| `app/(provider)/provider/earnings/page.tsx` | Server component wrapping EarningsSummary | **DO NOT TOUCH** — no changes needed |
| `components/provider/provider-sidebar.tsx` | Sidebar with Earnings link already present | **DO NOT TOUCH** — nav already exists |

### Existing Earnings Endpoints Detail

**`GET /earnings/summary`** returns:
```typescript
{
  totalEarned: number,        // all-time, cents
  pendingPayout: number,      // cents
  paidOut: number,            // cents
  thisMonthEarnings: number,  // cents
  completedJobsThisMonth: number,
  commissionType: string,     // "percentage" | "flat_per_job"
  flatFeeAmount: number | null,
  serviceRates: [{ name, category, commissionRate, platformCommissionPercent, providerSharePercent }]
}
```

**`GET /earnings/history?status=all&page=1&limit=20`** returns:
```typescript
{
  payouts: [{
    id, amount, status, paidAt, payoutType, createdAt,
    booking: { id, serviceId, contactName, estimatedPrice, finalPrice },
    service: { name, category, commissionRate }
  }],
  pagination: { page, limit, total }
}
```

**`GET /earnings/trends`** returns (monthly only):
```typescript
{ trends: [{ month: "YYYY-MM", earnings: number, jobCount: number }] }
```

**`GET /earnings/by-service`** returns:
```typescript
[{ serviceName, serviceCategory, commissionRate, providerSharePercent, earnings, jobCount }]
```

### What's Missing (Your Implementation Scope)

1. **Daily aggregation** — No daily earnings endpoint exists. Add to provider.ts
2. **Weekly aggregation** — No weekly earnings endpoint exists. Add to provider.ts
3. **Period selector UI** — Charts only show monthly. Add Daily/Weekly/Monthly toggle
4. **Explicit commission deducted** — History shows payout amount but doesn't show `bookingAmount` and `commissionDeducted` as separate columns. Enhance the join to include payment amount
5. **Period-specific KPI cards** — Only "This Month" exists. Add "Today" and "This Week"

### New Endpoint Implementation

**`GET /earnings/daily`** — Add inside existing provider.ts:
```typescript
// Last 30 days, grouped by date
app.get("/earnings/daily", async (c) => {
  const user = c.get("user");
  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const daily = await db
    .select({
      date: sql<string>`to_char(${providerPayouts.createdAt}, 'YYYY-MM-DD')`,
      earnings: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
      jobCount: sql<number>`count(*)`,
    })
    .from(providerPayouts)
    .where(and(
      eq(providerPayouts.providerId, provider.id),
      sql`${providerPayouts.createdAt} >= ${thirtyDaysAgo.toISOString()}`,
      eq(providerPayouts.payoutType, "standard"),
    ))
    .groupBy(sql`to_char(${providerPayouts.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${providerPayouts.createdAt}, 'YYYY-MM-DD')`);

  return c.json({ daily: daily.map(d => ({ ...d, earnings: Number(d.earnings), jobCount: Number(d.jobCount) })) });
});
```

**`GET /earnings/weekly`** — Same pattern but group by ISO week:
```sql
to_char(created_at, 'IYYY-IW')  -- ISO year-week
```

### Enhancing History Endpoint

Add `bookingAmount` and `commissionDeducted` to the history join. The booking amount comes from the payment (confirmed) or booking's finalPrice:

```typescript
// In the existing history endpoint, extend the select:
const paymentAmount = sql<number>`(
  SELECT coalesce(p.amount, 0)
  FROM payments p
  WHERE p."bookingId" = ${providerPayouts.bookingId}
  AND p.status = 'confirmed'
  LIMIT 1
)`;
// commissionDeducted = paymentAmount - payoutAmount (calculate client-side or in SQL)
```

### UI Period Selector Pattern

Use shadcn Tabs or a segmented control:
```typescript
"use client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("monthly");

<Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
  <TabsList>
    <TabsTrigger value="daily">Daily</TabsTrigger>
    <TabsTrigger value="weekly">Weekly</TabsTrigger>
    <TabsTrigger value="monthly">Monthly</TabsTrigger>
  </TabsList>
</Tabs>
```

### Chart X-Axis Labels by Period

```typescript
// Daily: "Feb 18", "Feb 19" — use date-fns format
// Weekly: "Week 7", "Week 8" or "Feb 10-16"
// Monthly: "Jan", "Feb" (existing pattern)
const xAxisFormatter = period === "daily"
  ? (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  : period === "weekly"
  ? (w: string) => `Wk ${w.split("-")[1]}`
  : (m: string) => new Date(m + "-01").toLocaleDateString("en-US", { month: "short" });
```

### Project Structure Notes

Files to modify:
- `server/api/routes/provider.ts` — add daily/weekly endpoints, enhance history response
- `components/provider/earnings-summary.tsx` — add period selector, period KPIs, enhance table columns
- `components/provider/earnings-charts.tsx` — make MonthlyEarningsChart accept dynamic period data

Files to REFERENCE (read patterns, do NOT modify):
- `components/admin/date-range-picker.tsx` — for date-related UI patterns
- `components/admin/revenue-analytics.tsx` — for filter + chart interaction patterns

No new files needed. This is a pure enhancement story.

### Architecture Compliance

- **Route pattern**: Add new endpoints inside existing `provider.ts` — do NOT create a new route file
- **Auth**: Provider routes already have `requireProvider` middleware applied globally
- **Route ordering**: Place `/earnings/daily` and `/earnings/weekly` BEFORE any `/earnings/:id` parameterized route (if one exists)
- **Money**: All amounts in cents. Format via `formatPrice()` on client
- **SQL aggregation**: Follow exact patterns from existing `/earnings/trends` endpoint
- **Zod v4**: `import { z } from "zod/v4"` if adding query param validation
- **Named exports**: `export function EarningsSummary()` — already follows this pattern
- **No try-catch**: Hono handles errors
- **Import paths**: `@/` alias only

### Previous Story Intelligence

From Story 3.1 (Tiered Commission):
- **3-tier payout priority**: flat_per_job > service commission > provider commission — earnings display must reflect actual payout amounts from the `providerPayouts` table, never recalculate
- **Commission context**: The summary endpoint already returns service rates with `providerSharePercent` — reuse this for the commission deducted display
- **Effective price**: `priceOverrideCents ?? confirmedPayment.amount` — when showing booking amount

From Story 3.3 (Batch Payouts):
- **Clawback records**: `payoutType = "clawback"` records have negative amounts — EXCLUDE from earnings aggregation (filter `payoutType = 'standard'`)
- **Payout status**: pending/paid/clawback — daily/weekly aggregation should only count `standard` type payouts

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5 Story 5.2]
- [Source: _bmad-output/project-context.md#Hono API Layer]
- [Source: server/api/routes/provider.ts — existing earnings endpoints]
- [Source: components/provider/earnings-summary.tsx — existing UI]
- [Source: components/provider/earnings-charts.tsx — existing charts]
- [Source: db/schema/provider-payouts.ts — payout data model]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- No debug issues encountered. TypeScript compilation passed with 0 errors in modified files (1 pre-existing error in unrelated admin.ts). ESLint passed with 0 errors.

### Completion Notes List

- **Task 1**: Added `GET /earnings/daily` (30-day window, grouped by YYYY-MM-DD) and `GET /earnings/weekly` (12-week window, grouped by ISO week with weekStart/weekEnd dates). Enhanced `GET /earnings/trends` with `?period=daily|weekly|monthly` query param — monthly remains the default for backward compatibility. All aggregation queries filter `payoutType = 'standard'` to exclude clawback records per Story 3.3 learnings.
- **Task 2**: Extended `GET /earnings/history` to include `bookingAmount` (from confirmed payment subquery, with fallback to priceOverrideCents/finalPrice/estimatedPrice) and `commissionDeducted` (bookingAmount - payoutAmount). Updated payout history table columns to: Date, Service, Booking Amount, Commission, My Payout, Status.
- **Task 3**: Added shadcn Tabs-based period selector (Daily/Weekly/Monthly) above the earnings chart. Created new `EarningsTrendChart` component that accepts dynamic period data and formats X-axis labels per period type (date for daily, "Wk N" for weekly, month abbreviation for monthly). Kept backward-compatible `MonthlyEarningsChart` wrapper export.
- **Task 4**: Enhanced `/earnings/summary` endpoint to return `todayEarnings`, `todayJobCount`, `thisWeekEarnings`, `thisWeekJobCount`. Added 3 period KPI cards (Today, This Week, This Month) with job counts. Reorganized existing summary cards from 4-column to 3-column grid (Total Earned, Pending, Paid Out) since This Month moved to period KPIs.

### File List

- `server/api/routes/provider.ts` — Modified: added /earnings/daily, /earnings/weekly endpoints; enhanced /earnings/trends with period param; enhanced /earnings/history with bookingAmount/commissionDeducted; enhanced /earnings/summary with today/week totals
- `components/provider/earnings-summary.tsx` — Modified: added period selector (Tabs), period KPI cards (Today/Week/Month), enhanced payout history table columns, separated trends fetch with period param
- `components/provider/earnings-charts.tsx` — Modified: added EarningsTrendChart with dynamic period/label support, kept MonthlyEarningsChart as backward-compatible wrapper

## Change Log

- 2026-02-18: Implemented Story 5.2 — Provider Earnings View enhancements. Added daily/weekly aggregation endpoints, period selector for charts, explicit commission breakdown in payout history, and period-specific KPI cards (Today/Week/Month).
- 2026-02-18: Code review fixes — (H1) Added missing payoutType=standard filter to monthly trends, (M1) Parallelized 3 summary DB queries with Promise.all, (M2) Fixed week start to Monday (ISO 8601) matching PostgreSQL date_trunc, (M3) Fixed JS falsy 0 check on bookingAmount subquery, (M5) Fixed loading skeleton grid mismatch (4-col→3-col).

"use client";

import { useState, useEffect, useCallback } from "react";
import { subDays, startOfDay, endOfDay } from "date-fns";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, CreditCard, Activity, Users, Loader2 } from "lucide-react";
import { DateRangePicker, type DateRange } from "@/components/admin/date-range-picker";
import { ExportButton } from "@/components/admin/export-button";
import { formatPrice } from "@/lib/utils";

const COLORS = [
  "hsl(var(--chart-1, 220 70% 50%))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
];

interface RevenueBreakdown {
  totals: {
    revenue: number;
    bookingCount: number;
    avgBookingValue: number;
  };
  bySource: Array<{ source: string; revenue: number; count: number }>;
  byCategory: Array<{ category: string; revenue: number; count: number }>;
  byMethod: Array<{ method: string; revenue: number; count: number }>;
  byTier: Array<{ tier: string; revenue: number; count: number }>;
  dailyTrend: Array<{ date: string; revenue: number; count: number }>;
}

interface OverviewData {
  pendingPayments: { count: number; total: number };
  payoutQueue: { count: number; total: number };
  activeBookings: number;
  onlineProviders: number;
}

export function FinancialReportsDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date()),
  });
  const [source, setSource] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [method, setMethod] = useState<string>("all");
  const [tier, setTier] = useState<string>("all");

  const [breakdown, setBreakdown] = useState<RevenueBreakdown | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams({
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
    });
    if (source !== "all") params.set("source", source);
    if (category !== "all") params.set("category", category);
    if (method !== "all") params.set("method", method);
    if (tier !== "all") params.set("tier", tier);
    return params.toString();
  }, [dateRange, source, category, method, tier]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQueryParams();
      const [breakdownRes, overviewRes] = await Promise.all([
        fetch(`/api/admin/financial-reports/revenue-breakdown?${qs}`),
        fetch("/api/admin/financial-reports/overview"),
      ]);
      if (breakdownRes.ok) setBreakdown(await breakdownRes.json());
      if (overviewRes.ok) setOverview(await overviewRes.json());
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportQs = buildQueryParams();

  if (loading && !breakdown) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Financial Reports</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-1" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Financial Reports</h1>
        <ExportButton
          endpoint={`/api/admin/financial-reports/revenue-breakdown/export?${exportQs}`}
          filename={`revenue-breakdown-${new Date().toISOString().split("T")[0]}.csv`}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="b2c">B2C</SelectItem>
            <SelectItem value="b2b">B2B</SelectItem>
          </SelectContent>
        </Select>

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="roadside">Roadside</SelectItem>
            <SelectItem value="diagnostics">Diagnostics</SelectItem>
          </SelectContent>
        </Select>

        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Payment Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="cashapp">CashApp</SelectItem>
            <SelectItem value="zelle">Zelle</SelectItem>
            <SelectItem value="stripe">Stripe</SelectItem>
          </SelectContent>
        </Select>

        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Time Block" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="after-hours">After-Hours</SelectItem>
            <SelectItem value="storm-mode">Storm Mode</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview KPIs */}
      {overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{overview.pendingPayments.count}</p>
              <p className="text-xs text-muted-foreground">
                {formatPrice(overview.pendingPayments.total)} total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payout Queue</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatPrice(overview.payoutQueue.total)}</p>
              <p className="text-xs text-muted-foreground">
                {overview.payoutQueue.count} pending payouts
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Bookings</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{overview.activeBookings}</p>
              <p className="text-xs text-muted-foreground">confirmed/dispatched/in progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online Providers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{overview.onlineProviders}</p>
              <p className="text-xs text-muted-foreground">available now</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Revenue totals */}
      {breakdown && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatPrice(breakdown.totals.revenue)}</p>
                <p className="text-xs text-muted-foreground">
                  {breakdown.totals.bookingCount} bookings
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Booking Value</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatPrice(breakdown.totals.avgBookingValue)}</p>
                <p className="text-xs text-muted-foreground">per confirmed booking</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Confirmed Bookings</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{breakdown.totals.bookingCount}</p>
                <p className="text-xs text-muted-foreground">in selected period</p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={breakdown.dailyTrend.map((d) => ({
                  date: d.date.slice(5),
                  revenue: d.revenue / 100,
                  count: d.count,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => formatPrice(Math.round(Number(v) * 100))}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      name === "revenue"
                        ? formatPrice(Math.round(Number(value) * 100))
                        : value,
                      name === "revenue" ? "Revenue" : "Bookings",
                    ]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="hsl(var(--primary, 220 70% 50%))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Breakdown Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* By Service Category - BarChart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Revenue by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={breakdown.byCategory.map((d) => ({
                    name: d.category,
                    revenue: d.revenue / 100,
                    count: d.count,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => formatPrice(Math.round(Number(v) * 100))}
                    />
                    <Tooltip
                      formatter={(value) => [
                        formatPrice(Math.round(Number(value) * 100)),
                        "Revenue",
                      ]}
                    />
                    <Bar dataKey="revenue" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* By Payment Method - PieChart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Revenue by Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={breakdown.byMethod.map((d) => ({
                        name: d.method,
                        value: d.revenue / 100,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) =>
                        `${name}: ${formatPrice(Math.round(Number(value) * 100))}`
                      }
                      style={{ fontSize: 11 }}
                    >
                      {breakdown.byMethod.map((_, index) => (
                        <Cell key={`method-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [
                        formatPrice(Math.round(Number(value) * 100)),
                        "Revenue",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* By Time-Block Tier - BarChart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Revenue by Time Block Tier</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={breakdown.byTier.map((d) => ({
                    name: d.tier,
                    revenue: d.revenue / 100,
                    count: d.count,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => formatPrice(Math.round(Number(v) * 100))}
                    />
                    <Tooltip
                      formatter={(value) => [
                        formatPrice(Math.round(Number(value) * 100)),
                        "Revenue",
                      ]}
                    />
                    <Bar dataKey="revenue" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* By Source B2B/B2C - PieChart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Revenue by Source (B2B/B2C)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={breakdown.bySource.map((d) => ({
                        name: d.source,
                        value: d.revenue / 100,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) =>
                        `${name}: ${formatPrice(Math.round(Number(value) * 100))}`
                      }
                      style={{ fontSize: 11 }}
                    >
                      {breakdown.bySource.map((_, index) => (
                        <Cell key={`source-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [
                        formatPrice(Math.round(Number(value) * 100)),
                        "Revenue",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = [
  "hsl(var(--chart-1, 220 70% 50%))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
];

type EarningsPeriod = "daily" | "weekly" | "monthly";

interface EarningsTrendChartProps {
  data: Array<{ label: string; earnings: number; jobCount: number }>;
  period: EarningsPeriod;
}

function formatXAxisLabel(label: string, period: EarningsPeriod): string {
  if (period === "daily") {
    const date = new Date(label + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (period === "weekly") {
    const weekNum = label.split("-")[1];
    return `Wk ${weekNum}`;
  }
  // monthly: "YYYY-MM" -> "Jan", "Feb", etc.
  const date = new Date(label + "-01T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short" });
}

const PERIOD_TITLES: Record<EarningsPeriod, string> = {
  daily: "Daily Earnings",
  weekly: "Weekly Earnings",
  monthly: "Monthly Earnings",
};

export function EarningsTrendChart({ data, period }: EarningsTrendChartProps) {
  const chartData = data.map((item) => ({
    label: formatXAxisLabel(item.label, period),
    earnings: item.earnings / 100,
    jobs: item.jobCount,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{PERIOD_TITLES[period]}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "Earnings"]}
              labelFormatter={(label) => `${PERIOD_TITLES[period]}: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="earnings"
              stroke="hsl(var(--primary, 220 70% 50%))"
              fill="hsl(var(--primary, 220 70% 50%))"
              fillOpacity={0.1}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Keep backward-compatible export
export function MonthlyEarningsChart({ data }: { data: Array<{ month: string; earnings: number; jobCount: number }> }) {
  const mapped = data.map((d) => ({ label: d.month, earnings: d.earnings, jobCount: d.jobCount }));
  return <EarningsTrendChart data={mapped} period="monthly" />;
}

interface ServiceBreakdownChartProps {
  data: Array<{ serviceName: string; earnings: number; jobCount: number }>;
}

export function ServiceBreakdownChart({ data }: ServiceBreakdownChartProps) {
  const chartData = data.map((item) => ({
    name: item.serviceName,
    value: item.earnings / 100,
    jobs: item.jobCount,
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Earnings by Service</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No earnings data yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Earnings by Service</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              label={({ name, value }) => `${name}: $${value.toFixed(0)}`}
              style={{ fontSize: 11 }}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "Earnings"]}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

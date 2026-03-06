"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TrendData {
  month: string;
  revenue: number;
  payouts: number;
  profit: number;
  profitMargin: number;
  jobCount: number;
}

interface ProfitTrendChartProps {
  data: TrendData[];
}

export function ProfitTrendChart({ data }: ProfitTrendChartProps) {
  const chartData = data.map((item) => ({
    month: item.month.slice(5), // MM format
    revenue: item.revenue / 100,
    payouts: item.payouts / 100,
    profit: item.profit / 100,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Monthly Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              formatter={(value) => [`$${Number(value).toFixed(2)}`, ""]}
              labelFormatter={(label) => `Month: ${label}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="hsl(var(--chart-1, 220 70% 50%))"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="payouts"
              name="Payouts"
              stroke="hsl(var(--chart-2, 160 60% 45%))"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="profit"
              name="Profit"
              stroke="hsl(var(--chart-3, 30 80% 55%))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface AgingBucket {
  label: string;
  amount: number;
  count: number;
}

interface AgingChartProps {
  data: AgingBucket[];
}

export function AgingChart({ data }: AgingChartProps) {
  const chartData = data.map((bucket) => ({
    name: bucket.label,
    amount: bucket.amount / 100,
    count: bucket.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Accounts Receivable Aging
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              type="number"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `$${v}`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10 }}
              width={80}
            />
            <Tooltip
              formatter={(value) => [
                `$${Number(value).toFixed(2)}`,
                "Outstanding",
              ]}
            />
            <Bar
              dataKey="amount"
              fill="hsl(var(--chart-4, 280 65% 60%))"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

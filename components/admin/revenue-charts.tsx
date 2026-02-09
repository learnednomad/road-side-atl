"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";

const COLORS = [
  "hsl(var(--chart-1, 220 70% 50%))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
];

interface DailyRevenueChartProps {
  data: Array<{ date: string; total: number; count: number }>;
  prevData: Array<{ date: string; total: number }>;
}

export function DailyRevenueChart({ data, prevData }: DailyRevenueChartProps) {
  const chartData = data.map((item, i) => ({
    date: item.date.slice(5), // MM-DD
    current: item.total / 100,
    previous: prevData[i] ? prevData[i].total / 100 : 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Daily Revenue</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              formatter={(value) => [`$${Number(value).toFixed(2)}`, ""]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="current"
              name="Current Period"
              stroke="hsl(var(--primary, 220 70% 50%))"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="previous"
              name="Previous Period"
              stroke="hsl(var(--muted-foreground, 220 10% 60%))"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface ServiceRevenueChartProps {
  data: Array<{ serviceName: string; total: number; count: number }>;
}

export function ServiceRevenueChart({ data }: ServiceRevenueChartProps) {
  const chartData = data.map((item) => ({
    name: item.serviceName,
    revenue: item.total / 100,
    count: item.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Revenue by Service</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="name"
              angle={-35}
              textAnchor="end"
              height={70}
              interval={0}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "Revenue"]}
            />
            <Bar dataKey="revenue" fill="hsl(var(--primary, 220 70% 50%))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface PaymentMethodChartProps {
  data: Array<{ method: string; total: number; count: number }>;
}

export function PaymentMethodChart({ data }: PaymentMethodChartProps) {
  const chartData = data.map((item) => ({
    name: item.method,
    value: item.total / 100,
    count: item.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Revenue by Payment Method
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
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
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "Revenue"]}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

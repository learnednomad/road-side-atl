"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Clock, DollarSign, TrendingUp } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { formatPrice } from "@/lib/utils";

interface StatsCardsProps {
  todayBookings: number;
  pendingBookings: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  sparklines?: { bookings: number[]; revenue: number[] };
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((value, i) => ({ v: value, i }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#grad-${color})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StatsCards({
  todayBookings,
  pendingBookings,
  weeklyRevenue,
  monthlyRevenue,
  sparklines,
}: StatsCardsProps) {
  const cards = [
    {
      title: "Today's Bookings",
      value: todayBookings.toString(),
      icon: CalendarDays,
      sparkline: sparklines?.bookings,
      color: "#3b82f6",
    },
    {
      title: "Pending",
      value: pendingBookings.toString(),
      icon: Clock,
      sparkline: undefined,
      color: "#f59e0b",
    },
    {
      title: "Weekly Revenue",
      value: formatPrice(weeklyRevenue),
      icon: DollarSign,
      sparkline: sparklines?.revenue,
      color: "#10b981",
    },
    {
      title: "Monthly Revenue",
      value: formatPrice(monthlyRevenue),
      icon: TrendingUp,
      sparkline: undefined,
      color: "#8b5cf6",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{card.value}</p>
            {card.sparkline && card.sparkline.length > 0 && (
              <div className="mt-2">
                <MiniSparkline data={card.sparkline} color={card.color} />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

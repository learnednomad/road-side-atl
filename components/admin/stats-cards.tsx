import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Clock, DollarSign, TrendingUp } from "lucide-react";

interface StatsCardsProps {
  todayBookings: number;
  pendingBookings: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function StatsCards({
  todayBookings,
  pendingBookings,
  weeklyRevenue,
  monthlyRevenue,
}: StatsCardsProps) {
  const cards = [
    {
      title: "Today's Bookings",
      value: todayBookings.toString(),
      icon: CalendarDays,
    },
    {
      title: "Pending",
      value: pendingBookings.toString(),
      icon: Clock,
    },
    {
      title: "Weekly Revenue",
      value: formatPrice(weeklyRevenue),
      icon: DollarSign,
    },
    {
      title: "Monthly Revenue",
      value: formatPrice(monthlyRevenue),
      icon: TrendingUp,
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

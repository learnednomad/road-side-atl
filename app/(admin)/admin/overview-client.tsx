"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatsCards } from "@/components/admin/stats-cards";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BookingStatus } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";

interface Props {
  stats: {
    todayBookings: number;
    pendingBookings: number;
    weeklyRevenue: number;
    monthlyRevenue: number;
  };
  recentBookings: Array<{
    booking: {
      id: string;
      contactName: string;
      estimatedPrice: number;
      status: string;
      createdAt: string;
    };
    service: {
      name: string;
    };
  }>;
}

export function AdminOverviewClient({ stats, recentBookings }: Props) {
  const [sparklines, setSparklines] = useState<{
    bookings: number[];
    revenue: number[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats/sparklines")
      .then((res) => res.json())
      .then((data) => setSparklines({ bookings: data.bookings, revenue: data.revenue }))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <StatsCards
        todayBookings={stats.todayBookings}
        pendingBookings={stats.pendingBookings}
        weeklyRevenue={stats.weeklyRevenue}
        monthlyRevenue={stats.monthlyRevenue}
        sparklines={sparklines ?? undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle>Recent Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {recentBookings.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No bookings yet.
            </p>
          ) : (
            <div className="space-y-3">
              {recentBookings.map(({ booking, service }) => (
                <Link
                  key={booking.id}
                  href={`/admin/bookings/${booking.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{booking.contactName}</p>
                    <p className="text-xs text-muted-foreground">
                      {service.name} &middot;{" "}
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {formatPrice(booking.estimatedPrice)}
                    </span>
                    <StatusBadge status={booking.status as BookingStatus} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

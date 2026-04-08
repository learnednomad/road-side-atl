"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Users, Wrench } from "lucide-react";

interface BetaStats {
  betaActive: boolean;
  betaUserCount: number;
  mechanicBookingCount: number;
  startDate: string | null;
  endDate: string | null;
}

export function BetaStatsCards() {
  const [stats, setStats] = useState<BetaStats | null>(null);

  useEffect(() => {
    fetch("/api/admin/beta/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  if (!stats) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Beta Status</CardTitle>
          <FlaskConical className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {stats.betaActive ? (
            <Badge variant="default" className="bg-violet-600 text-base">Active</Badge>
          ) : (
            <Badge variant="secondary" className="text-base">Inactive</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Beta Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{stats.betaUserCount}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mechanic Bookings</CardTitle>
          <Wrench className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{stats.mechanicBookingCount}</p>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JobCard } from "@/components/provider/job-card";
import { LocationTracker } from "@/components/provider/location-tracker";
import { useWS } from "@/components/providers/websocket-provider";
import { toast } from "sonner";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import type { BookingStatus } from "@/lib/constants";

interface JobData {
  booking: {
    id: string;
    status: BookingStatus;
    contactName: string;
    contactPhone: string;
    estimatedPrice: number;
    location: { address: string };
    vehicleInfo: { year: string; make: string; model: string; color: string };
  };
  service: { name: string };
}

interface Stats {
  todayJobs: number;
  weekEarnings: number;
  totalCompleted: number;
}

export default function ProviderDashboard() {
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const { lastEvent } = useWS();

  function fetchData() {
    setLoading(true);
    setFetchError(false);
    Promise.all([
      fetch("/api/provider/jobs?status=dispatched").then((r) => r.json()),
      fetch("/api/provider/stats").then((r) => r.json()),
    ])
      .then(([jobsData, statsData]) => {
        setJobs(jobsData.data || []);
        setStats(statsData);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchData();
  }, []);

  // Listen for new job assignments
  useEffect(() => {
    if (lastEvent?.type === "provider:job_assigned") {
      toast.info("New job assigned!");
      // Refresh jobs
      fetch("/api/provider/jobs?status=dispatched")
        .then((r) => r.json())
        .then((data) => setJobs(data.data || []))
        .catch(() => {});
    }
  }, [lastEvent]);

  async function handleAccept(bookingId: string) {
    const res = await fetch(`/api/provider/jobs/${bookingId}/accept`, { method: "PATCH" });
    if (res.ok) {
      toast.success("Job accepted");
      setJobs((prev) => prev.filter((j) => j.booking.id !== bookingId));
    } else {
      toast.error("Failed to accept job");
    }
  }

  async function handleReject(bookingId: string) {
    const res = await fetch(`/api/provider/jobs/${bookingId}/reject`, { method: "PATCH" });
    if (res.ok) {
      toast.success("Job rejected");
      setJobs((prev) => prev.filter((j) => j.booking.id !== bookingId));
    } else {
      toast.error("Failed to reject job");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <LocationTracker />
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Jobs Today</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.todayJobs}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Week Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">${(stats.weekEarnings / 100).toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalCompleted}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Jobs */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Pending Assignments</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /><span className="sr-only">Loading...</span>
          </div>
        ) : fetchError ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-8">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">Failed to load data. Please try again.</p>
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No pending assignments.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {jobs.map(({ booking, service }) => (
              <JobCard
                key={booking.id}
                booking={booking}
                serviceName={service.name}
                showActions
                onAccept={() => handleAccept(booking.id)}
                onReject={() => handleReject(booking.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

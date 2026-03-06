"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatusUpdater } from "@/components/provider/status-updater";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { BookingStatus } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";

interface JobData {
  booking: {
    id: string;
    status: BookingStatus;
    contactName: string;
    contactPhone: string;
    estimatedPrice: number;
    createdAt: string;
    location: { address: string };
  };
  service: { name: string };
}

export default function ProviderJobsPage() {
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      if (filter !== "all") params.set("status", filter);

      const res = await fetch(`/api/provider/jobs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.data || []);
        setTotalPages(data.totalPages || 1);
      } else {
        setFetchError(true);
      }
    } catch {
      setFetchError(true);
    }
    setLoading(false);
  }, [page, filter]);

  useEffect(() => {
    fetchJobs(); // eslint-disable-line react-hooks/set-state-in-effect -- data fetching pattern
  }, [fetchJobs]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Job History</h1>

      <div className="flex items-center gap-4">
        <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-muted-foreground">Failed to load jobs.</p>
            <Button variant="outline" size="sm" onClick={fetchJobs}>
              <RefreshCw className="mr-2 h-3 w-3" />
              Retry
            </Button>
          </div>
        ) : jobs.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No jobs found.
          </p>
        ) : (
          jobs.map(({ booking, service }) => (
            <Card key={booking.id}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <Link
                      href={`/provider/jobs/${booking.id}`}
                      className="font-medium hover:underline"
                    >
                      {booking.contactName}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {service.name}
                    </p>
                  </div>
                  <p className="text-sm font-medium">
                    {formatPrice(booking.estimatedPrice)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {booking.status.replace("_", " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(booking.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <StatusUpdater
                  bookingId={booking.id}
                  currentStatus={booking.status}
                  onStatusChange={() => fetchJobs()}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : fetchError ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                    <p className="text-sm text-muted-foreground">Failed to load jobs.</p>
                    <Button variant="outline" size="sm" onClick={fetchJobs}>
                      <RefreshCw className="mr-2 h-3 w-3" />
                      Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No jobs found.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map(({ booking, service }) => (
                <TableRow key={booking.id}>
                  <TableCell className="text-sm">
                    {new Date(booking.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/provider/jobs/${booking.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {booking.contactName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{service.name}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {booking.location.address}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {booking.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatPrice(booking.estimatedPrice)}
                  </TableCell>
                  <TableCell>
                    <StatusUpdater
                      bookingId={booking.id}
                      currentStatus={booking.status}
                      onStatusChange={() => fetchJobs()}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

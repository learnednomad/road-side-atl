"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";

interface ObservationData {
  observation: {
    id: string;
    bookingId: string;
    items: { category: string; description: string; severity: string; photoUrl?: string }[];
    followUpSent: boolean;
    createdAt: string;
  };
  booking: {
    id: string;
    contactName: string;
  };
  service: {
    name: string;
  };
}

export default function ProviderObservationsPage() {
  const [observations, setObservations] = useState<ObservationData[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const fetchObservations = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`/api/provider/observations?page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setObservations(data.data || []);
        setTotalPages(data.totalPages || 1);
      } else {
        setFetchError(true);
      }
    } catch {
      setFetchError(true);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    fetchObservations();
  }, [fetchObservations]);

  const severityColor = (severity: string): "default" | "destructive" | "secondary" => {
    switch (severity) {
      case "high": return "destructive";
      case "medium": return "default";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Vehicle Observations</h1>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Follow-Up</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : fetchError ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                    <p className="text-sm text-muted-foreground">Failed to load observations.</p>
                    <Button variant="outline" size="sm" onClick={fetchObservations}>
                      <RefreshCw className="mr-2 h-3 w-3" /> Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : observations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No observations submitted yet.
                </TableCell>
              </TableRow>
            ) : (
              observations.map(({ observation, booking, service }) => {
                const maxSeverity = observation.items.reduce((max, item) => {
                  const order = { low: 0, medium: 1, high: 2 };
                  return (order[item.severity as keyof typeof order] || 0) > (order[max as keyof typeof order] || 0) ? item.severity : max;
                }, "low");
                return (
                  <TableRow key={observation.id}>
                    <TableCell className="text-sm">
                      {new Date(observation.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{booking.contactName}</TableCell>
                    <TableCell className="text-sm">{service.name}</TableCell>
                    <TableCell className="text-sm">{observation.items.length} items</TableCell>
                    <TableCell>
                      <Badge variant={severityColor(maxSeverity)}>
                        {maxSeverity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={observation.followUpSent ? "default" : "secondary"}>
                        {observation.followUpSent ? "Sent" : "Not sent"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ExportButton } from "./export-button";
import type { BookingStatus, PaymentMethod } from "@/lib/constants";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Search, Zap } from "lucide-react";
import { useWS } from "@/components/providers/websocket-provider";
import { formatPrice } from "@/lib/utils";

interface BookingRow {
  booking: {
    id: string;
    status: BookingStatus;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    estimatedPrice: number;
    finalPrice: number | null;
    providerId: string | null;
    scheduledAt: string | null;
    createdAt: string;
    vehicleInfo: { year: string; make: string; model: string; color: string };
    location: { address: string };
  };
  service: {
    name: string;
    category: string;
  };
  payments: Array<{
    id: string;
    method: PaymentMethod;
    status: string;
    amount: number;
  }>;
}

interface Provider {
  id: string;
  name: string;
  status: string;
}

interface BookingsTableProps {
  bookings: BookingRow[];
  total: number;
  page: number;
  totalPages: number;
}

const statusFlow: BookingStatus[] = [
  "pending",
  "confirmed",
  "dispatched",
  "in_progress",
  "completed",
];

export function BookingsTable({
  bookings: initialBookings,
  total: initialTotal,
  page: initialPage,
  totalPages: initialTotalPages,
}: BookingsTableProps) {
  const [bookings, setBookings] = useState(initialBookings);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const { lastEvent } = useWS();

  // WebSocket real-time updates
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === "booking:created") {
      // Refresh bookings list
      fetchBookings();
    }
    if (lastEvent.type === "booking:status_changed") {
      const { bookingId, status } = lastEvent.data as { bookingId: string; status: string };
      setBookings((prev) =>
        prev.map((b) =>
          b.booking.id === bookingId
            ? { ...b, booking: { ...b.booking, status: status as BookingStatus } }
            : b
        )
      );
    }
  }, [lastEvent]);

  // Fetch providers on mount
  useEffect(() => {
    fetch("/api/admin/providers?status=active")
      .then((r) => r.json())
      .then((data) => setProviders(data))
      .catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch bookings when page, filter, or search changes
  const fetchBookings = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", "20");
    if (filter !== "all") params.set("status", filter);
    if (searchDebounced) params.set("search", searchDebounced);

    const res = await fetch(`/api/admin/bookings?${params}`);
    if (res.ok) {
      const data = await res.json();
      setBookings(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    }
  }, [page, filter, searchDebounced]);

  // Only re-fetch on filter/search changes (not on initial render since we have SSR data)
  const [hasInteracted, setHasInteracted] = useState(false);
  useEffect(() => {
    if (hasInteracted) {
      fetchBookings();
    }
  }, [fetchBookings, hasInteracted]);

  function handleFilterChange(value: string) {
    setHasInteracted(true);
    setFilter(value);
    setPage(1);
  }

  function handleSearchChange(value: string) {
    setHasInteracted(true);
    setSearch(value);
    setPage(1);
  }

  function handlePageChange(newPage: number) {
    setHasInteracted(true);
    setPage(newPage);
  }

  async function updateStatus(bookingId: string, status: BookingStatus) {
    const res = await fetch(`/api/admin/bookings/${bookingId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setBookings((prev) =>
        prev.map((b) =>
          b.booking.id === bookingId
            ? { ...b, booking: { ...b.booking, status } }
            : b
        )
      );
      toast.success("Status updated");
    } else {
      toast.error("Failed to update status");
    }
  }

  const [paymentDialogOpen, setPaymentDialogOpen] = useState<string | null>(null);

  async function confirmPayment(bookingId: string, method: PaymentMethod) {
    const res = await fetch(`/api/admin/bookings/${bookingId}/confirm-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    });
    if (res.ok) {
      toast.success("Payment confirmed");
      setPaymentDialogOpen(null);
      setBookings((prev) =>
        prev.map((b) =>
          b.booking.id === bookingId
            ? {
                ...b,
                payments: [
                  ...b.payments,
                  {
                    id: "new",
                    method,
                    status: "confirmed",
                    amount: b.booking.estimatedPrice,
                  },
                ],
              }
            : b
        )
      );
    } else {
      toast.error("Failed to confirm payment");
    }
  }

  async function autoAssign(bookingId: string) {
    // First confirm the booking to trigger auto-dispatch
    const res = await fetch(`/api/admin/bookings/${bookingId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.dispatchResult?.success) {
        toast.success(`Auto-assigned to ${data.dispatchResult.providerName} (${data.dispatchResult.distanceMiles} mi)`);
        setBookings((prev) =>
          prev.map((b) =>
            b.booking.id === bookingId
              ? { ...b, booking: { ...b.booking, status: "dispatched", providerId: data.dispatchResult.providerId } }
              : b
          )
        );
      } else {
        toast.info(data.dispatchResult?.reason || "No provider available for auto-dispatch");
        setBookings((prev) =>
          prev.map((b) =>
            b.booking.id === bookingId
              ? { ...b, booking: { ...b.booking, status: "confirmed" } }
              : b
          )
        );
      }
    } else {
      toast.error("Failed to trigger auto-dispatch");
    }
  }

  async function assignProvider(bookingId: string, providerId: string) {
    const res = await fetch(`/api/admin/bookings/${bookingId}/assign-provider`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId }),
    });
    if (res.ok) {
      setBookings((prev) =>
        prev.map((b) =>
          b.booking.id === bookingId
            ? { ...b, booking: { ...b.booking, providerId } }
            : b
        )
      );
      toast.success("Provider assigned");
    } else {
      toast.error("Failed to assign provider");
    }
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, email..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-64 pl-9"
          />
        </div>
        <Select value={filter} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {total} booking{total !== 1 ? "s" : ""}
        </span>
        <div className="ml-auto">
          <ExportButton
            endpoint={`/api/admin/bookings/export${filter !== "all" ? `?status=${filter}` : ""}`}
            filename="bookings.csv"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No bookings found.
                </TableCell>
              </TableRow>
            ) : (
              bookings.map(({ booking, service, payments: pays }) => {
                const confirmedPayment = pays.find(
                  (p) => p.status === "confirmed"
                );
                return (
                  <TableRow key={booking.id}>
                    <TableCell className="text-sm">
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {booking.contactName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {booking.contactPhone}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{service.name}</TableCell>
                    <TableCell>
                      <Select
                        value={booking.providerId || "unassigned"}
                        onValueChange={(val) => {
                          if (val !== "unassigned") {
                            assignProvider(booking.id, val);
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue placeholder="Assign..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {providers.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={booking.status} />
                    </TableCell>
                    <TableCell>
                      {confirmedPayment ? (
                        <Badge variant="outline" className="text-green-600">
                          {confirmedPayment.method}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Unpaid</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatPrice(
                        booking.finalPrice || booking.estimatedPrice
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Select
                          value={booking.status}
                          onValueChange={(val) =>
                            updateStatus(booking.id, val as BookingStatus)
                          }
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusFlow.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s.replace("_", " ")}
                              </SelectItem>
                            ))}
                            <SelectItem value="cancelled">cancelled</SelectItem>
                          </SelectContent>
                        </Select>

                        {!booking.providerId && booking.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => autoAssign(booking.id)}
                            title="Auto-assign nearest provider"
                            aria-label="Auto-assign nearest provider"
                          >
                            <Zap className="h-3 w-3" />
                          </Button>
                        )}

                        {!confirmedPayment && (
                          <Dialog
                            open={paymentDialogOpen === booking.id}
                            onOpenChange={(open) =>
                              setPaymentDialogOpen(open ? booking.id : null)
                            }
                          >
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Confirm Pay
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Confirm Payment</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                  Confirm payment of{" "}
                                  {formatPrice(booking.estimatedPrice)} for{" "}
                                  {booking.contactName}?
                                </p>
                                <div className="flex gap-2">
                                  {(
                                    ["cash", "cashapp", "zelle"] as const
                                  ).map((method) => (
                                    <Button
                                      key={method}
                                      variant="outline"
                                      onClick={() =>
                                        confirmPayment(booking.id, method)
                                      }
                                    >
                                      {method}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

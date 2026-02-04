"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { BookingStatus, PaymentMethod } from "@/lib/constants";
import { toast } from "sonner";

interface BookingRow {
  booking: {
    id: string;
    status: BookingStatus;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    estimatedPrice: number;
    finalPrice: number | null;
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

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
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
}: {
  bookings: BookingRow[];
}) {
  const [bookings, setBookings] = useState(initialBookings);
  const [filter, setFilter] = useState("all");

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

  async function confirmPayment(
    bookingId: string,
    method: PaymentMethod
  ) {
    const res = await fetch(`/api/admin/bookings/${bookingId}/confirm-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    });
    if (res.ok) {
      toast.success("Payment confirmed");
      // Update local state
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

  const filtered =
    filter === "all"
      ? bookings
      : bookings.filter((b) => b.booking.status === filter);

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex items-center gap-4">
        <Select value={filter} onValueChange={setFilter}>
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
          {filtered.length} booking{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No bookings found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(({ booking, service, payments: pays }) => {
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
                        {/* Status update */}
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

                        {/* Payment confirm */}
                        {!confirmedPayment && (
                          <Dialog>
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
    </div>
  );
}

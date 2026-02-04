"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import type { BookingStatus } from "@/lib/constants";
import Link from "next/link";

interface BookingItem {
  booking: {
    id: string;
    status: BookingStatus;
    contactName: string;
    contactPhone: string;
    estimatedPrice: number;
    scheduledAt: string | null;
    createdAt: string;
    vehicleInfo: { year: string; make: string; model: string; color: string };
    location: { address: string };
  };
  service: {
    name: string;
    category: string;
  };
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function BookingList({ bookings }: { bookings: BookingItem[] }) {
  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="mb-4 text-muted-foreground">
            You don&apos;t have any bookings yet.
          </p>
          <Link href="/book">
            <Button>Book a Service</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {bookings.map(({ booking, service }) => (
        <Card key={booking.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">
              {service.name}
            </CardTitle>
            <StatusBadge status={booking.status} />
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Vehicle</p>
                <p>
                  {booking.vehicleInfo.year} {booking.vehicleInfo.make}{" "}
                  {booking.vehicleInfo.model}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Location</p>
                <p>{booking.location.address}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p>
                  {booking.scheduledAt
                    ? new Date(booking.scheduledAt).toLocaleDateString()
                    : "ASAP"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Estimated Price</p>
                <p className="font-semibold">
                  {formatPrice(booking.estimatedPrice)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Booking #{booking.id.slice(0, 8).toUpperCase()} &middot; Created{" "}
              {new Date(booking.createdAt).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/constants";

interface JobCardProps {
  booking: {
    id: string;
    status: BookingStatus;
    contactName: string;
    contactPhone: string;
    estimatedPrice: number;
    location: { address: string };
    vehicleInfo: { year: string; make: string; model: string; color: string };
  };
  serviceName: string;
  onAccept?: () => void;
  onReject?: () => void;
  showActions?: boolean;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  dispatched: "bg-purple-100 text-purple-800",
  in_progress: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function JobCard({ booking, serviceName, onAccept, onReject, showActions = false }: JobCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{booking.contactName}</h3>
              <Badge className={statusColors[booking.status] || ""}>
                {booking.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{serviceName}</p>
            <p className="text-sm text-muted-foreground">{booking.location.address}</p>
            <p className="text-sm text-muted-foreground">
              {booking.vehicleInfo.year} {booking.vehicleInfo.make} {booking.vehicleInfo.model} ({booking.vehicleInfo.color})
            </p>
            <p className="text-sm font-medium">{formatPrice(booking.estimatedPrice)}</p>
          </div>

          {showActions && (booking.status === "dispatched" || booking.status === "confirmed") && (
            <div className="flex gap-2">
              {onAccept && (
                <Button size="sm" onClick={onAccept}>
                  Accept
                </Button>
              )}
              {onReject && (
                <Button size="sm" variant="outline" onClick={onReject}>
                  Reject
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

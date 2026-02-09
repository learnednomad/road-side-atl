"use client";

import { useState, useEffect } from "react";
import { useWebSocket } from "@/lib/hooks/use-websocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  MapPin,
  Phone,
  FileText,
  Car,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatPrice } from "@/lib/utils";

interface Booking {
  booking: {
    id: string;
    status: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    vehicleInfo: {
      make: string;
      model: string;
      year: string | number;
      color?: string;
      licensePlate?: string;
    };
    location: {
      address: string;
      destination?: string;
    };
    estimatedPrice: number;
    finalPrice: number | null;
    towingMiles: number | null;
    notes: string | null;
    createdAt: string;
    scheduledAt: string | null;
  };
  service: {
    id: string;
    name: string;
    slug: string;
    category: string;
  };
  provider: {
    id: string;
    name: string;
    phone: string;
  } | null;
  payments: {
    id: string;
    amount: number;
    method: string;
    status: string;
    confirmedAt: string | null;
  }[];
}

interface MyBookingsClientProps {
  initialBookings: Booking[];
  userId: string;
}

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-800", icon: CheckCircle2 },
  dispatched: { label: "Dispatched", color: "bg-purple-100 text-purple-800", icon: Truck },
  in_progress: { label: "In Progress", color: "bg-orange-100 text-orange-800", icon: Truck },
  completed: { label: "Completed", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground", icon: XCircle },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MyBookingsClient({ initialBookings, userId }: MyBookingsClientProps) {
  const [bookings, setBookings] = useState(initialBookings);
  const { lastEvent, isConnected } = useWebSocket({ userId, role: "customer" });

  // Handle real-time updates
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === "booking:status_changed") {
      const { bookingId, status } = lastEvent.data as { bookingId: string; status: string };
      setBookings((prev) =>
        prev.map((b) =>
          b.booking.id === bookingId
            ? { ...b, booking: { ...b.booking, status } }
            : b
        )
      );
      const statusInfo = statusConfig[status];
      toast.info(`Booking status updated: ${statusInfo?.label || status}`);
    }

    if (lastEvent.type === "provider:location_updated") {
      // Just show a subtle indicator that provider location was updated
      // The actual tracking page handles the map updates
    }
  }, [lastEvent]);

  // Separate active and completed bookings
  const activeStatuses = ["pending", "confirmed", "dispatched", "in_progress"];
  const activeBookings = bookings.filter((b) =>
    activeStatuses.includes(b.booking.status)
  );
  const completedBookings = bookings.filter(
    (b) => b.booking.status === "completed"
  );
  const cancelledBookings = bookings.filter(
    (b) => b.booking.status === "cancelled"
  );

  return (
    <div className="space-y-6">
      {/* Connection status */}
      {isConnected && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Live updates enabled
        </div>
      )}

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">
            Active ({activeBookings.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedBookings.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled ({cancelledBookings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {activeBookings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground">No active bookings</h3>
                <p className="text-muted-foreground mt-2">
                  You don't have any active service requests at the moment.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/services">Book a Service</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeBookings.map((item) => (
                <BookingCard key={item.booking.id} data={item} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {completedBookings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No completed bookings yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {completedBookings.map((item) => (
                <BookingCard key={item.booking.id} data={item} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="mt-6">
          {cancelledBookings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No cancelled bookings.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {cancelledBookings.map((item) => (
                <BookingCard key={item.booking.id} data={item} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BookingCard({ data }: { data: Booking }) {
  const { booking, service, provider, payments } = data;
  const status = statusConfig[booking.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const isPaid = payments.some((p) => p.status === "confirmed");
  const isActive = ["pending", "confirmed", "dispatched", "in_progress"].includes(
    booking.status
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{service.name}</CardTitle>
            <Badge className={status.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground">
            {formatDate(booking.createdAt)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vehicle Info */}
        <div className="flex items-start gap-2">
          <Car className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium">
              {booking.vehicleInfo.year} {booking.vehicleInfo.make}{" "}
              {booking.vehicleInfo.model}
            </p>
            {booking.vehicleInfo.color && (
              <p className="text-xs text-muted-foreground">
                {booking.vehicleInfo.color}
                {booking.vehicleInfo.licensePlate &&
                  ` - ${booking.vehicleInfo.licensePlate}`}
              </p>
            )}
          </div>
        </div>

        {/* Location */}
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm">{booking.location.address}</p>
            {booking.location.destination && (
              <p className="text-xs text-muted-foreground">
                To: {booking.location.destination}
              </p>
            )}
          </div>
        </div>

        {/* Provider Info (if assigned) */}
        {provider && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm font-medium text-blue-900">
              Provider: {provider.name}
            </p>
            <a
              href={`tel:${provider.phone}`}
              className="text-sm text-blue-700 flex items-center gap-1 mt-1"
            >
              <Phone className="h-3 w-3" />
              {provider.phone}
            </a>
          </div>
        )}

        {/* Price & Payment */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div>
            <p className="text-sm text-muted-foreground">
              {booking.finalPrice ? "Final Price" : "Estimated Price"}
            </p>
            <p className="text-lg font-bold">
              {formatPrice(booking.finalPrice || booking.estimatedPrice)}
            </p>
            {booking.towingMiles && (
              <p className="text-xs text-muted-foreground">
                Includes {booking.towingMiles} miles towing
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPaid && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                Paid
              </Badge>
            )}
            {isActive && (
              <Button asChild size="sm">
                <Link href={`/track/${booking.id}`}>Track Live</Link>
              </Button>
            )}
            {booking.status === "completed" && isPaid && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/api/receipts/${booking.id}`} target="_blank">
                  <FileText className="h-4 w-4 mr-1" />
                  Receipt
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

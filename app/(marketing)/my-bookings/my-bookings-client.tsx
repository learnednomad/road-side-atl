"use client";

import { useState } from "react";
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
  Star,
} from "lucide-react";
import Link from "next/link";
import { LoyaltyRedeemButton } from "@/components/account/loyalty-redeem-button";
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
  hasReview: boolean;
}

interface MyBookingsClientProps {
  initialBookings: Booking[];
  userId: string;
  loyaltyBalance: number;
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

export function MyBookingsClient({ initialBookings, userId, loyaltyBalance }: MyBookingsClientProps) {
  const [bookings, setBookings] = useState(initialBookings);
  const [pointsBalance, setPointsBalance] = useState(loyaltyBalance);

  // Loyalty redemption reduced the booking's price and the balance.
  const handleRedeemed = (bookingId: string, discountCents: number) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.booking.id === bookingId
          ? {
              ...b,
              booking: {
                ...b.booking,
                estimatedPrice: b.booking.estimatedPrice - discountCents,
              },
            }
          : b
      )
    );
    setPointsBalance((prev) => Math.max(0, prev - discountCents));
  };

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
      {/* Loyalty balance */}
      {pointsBalance > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white/60 px-4 py-3">
          <p className="text-sm text-neutral-700">
            <span className="font-mono font-semibold">{pointsBalance.toLocaleString("en-US")}</span>
            {" "}loyalty points available — worth {formatPrice(pointsBalance)} off a pending booking.
          </p>
          <Link
            href="/account/loyalty"
            className="text-sm font-medium text-neutral-950 underline-offset-4 hover:underline"
          >
            View history →
          </Link>
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
                  You don&apos;t have any active service requests at the moment.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/services">Book a Service</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeBookings.map((item) => (
                <BookingCard key={item.booking.id} data={item} pointsBalance={pointsBalance} onRedeemed={handleRedeemed} />
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
                <BookingCard key={item.booking.id} data={item} pointsBalance={pointsBalance} onRedeemed={handleRedeemed} />
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
                <BookingCard key={item.booking.id} data={item} pointsBalance={pointsBalance} onRedeemed={handleRedeemed} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BookingCard({
  data,
  pointsBalance,
  onRedeemed,
}: {
  data: Booking;
  pointsBalance: number;
  onRedeemed: (bookingId: string, discountCents: number) => void;
}) {
  const { booking, service, provider, payments, hasReview } = data;
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
            {booking.status === "pending" && !isPaid && (
              <LoyaltyRedeemButton
                bookingId={booking.id}
                estimatedPrice={booking.estimatedPrice}
                balance={pointsBalance}
                onRedeemed={(discountCents) => onRedeemed(booking.id, discountCents)}
              />
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
            {booking.status === "completed" && provider && !hasReview && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/track/${booking.id}#review`}>
                  <Star className="h-4 w-4 mr-1" />
                  Review
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

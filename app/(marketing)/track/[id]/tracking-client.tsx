"use client";

import { useEffect, useState } from "react";
import { useWebSocket } from "@/lib/hooks/use-websocket";
import { LiveTrackingMap } from "@/components/maps/live-tracking-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, MapPin, Car, Clock, CheckCircle2, Truck, CircleDot, Star, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ReviewForm } from "@/components/reviews/review-form";
import { BUSINESS } from "@/lib/constants";
import Image from "next/image";

interface BookingData {
  id: string;
  status: string;
  serviceName: string;
  vehicleInfo: { year: string; make: string; model: string; color: string };
  location: {
    address: string;
    latitude?: number;
    longitude?: number;
    destination?: string;
    destinationLatitude?: number;
    destinationLongitude?: number;
  };
  contactName: string;
  estimatedPrice: number;
  createdAt: string;
  scheduledAt: string | null;
}

interface ProviderData {
  id: string;
  name: string;
  phone: string;
  rating: number | null;
  photoUrl: string | null;
  currentLocation: { lat: number; lng: number; updatedAt: string } | null;
}

interface TrackingClientProps {
  booking: BookingData;
  provider: ProviderData | null;
  hasReview?: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-yellow-500", icon: <Clock className="h-4 w-4" /> },
  confirmed: { label: "Confirmed", color: "bg-blue-500", icon: <CheckCircle2 className="h-4 w-4" /> },
  dispatched: { label: "Provider En Route", color: "bg-purple-500", icon: <Truck className="h-4 w-4" /> },
  in_progress: { label: "In Progress", color: "bg-orange-500", icon: <CircleDot className="h-4 w-4" /> },
  completed: { label: "Completed", color: "bg-green-500", icon: <CheckCircle2 className="h-4 w-4" /> },
  cancelled: { label: "Cancelled", color: "bg-gray-500", icon: <Clock className="h-4 w-4" /> },
};

export function TrackingClient({ booking: initialBooking, provider: initialProvider, hasReview: initialHasReview = false }: TrackingClientProps) {
  const [booking, setBooking] = useState(initialBooking);
  const [providerLocation, setProviderLocation] = useState(initialProvider?.currentLocation || null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [hasReview, setHasReview] = useState(initialHasReview);
  const { lastEvent, isConnected } = useWebSocket({ userId: booking.id, role: "tracking", enabled: true });

  // Listen for real-time updates
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === "booking:status_changed") {
      const data = lastEvent.data as { bookingId: string; status: string };
      if (data.bookingId === booking.id) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- websocket-driven state update
        setBooking((prev) => ({ ...prev, status: data.status }));
      }
    }

    if (lastEvent.type === "provider:location_updated") {
      const data = lastEvent.data as { providerId: string; lat: number; lng: number; etaMinutes?: number };
      if (initialProvider && data.providerId === initialProvider.id) {
        setProviderLocation({ lat: data.lat, lng: data.lng, updatedAt: new Date().toISOString() });
        if (data.etaMinutes !== undefined) {
          setEtaMinutes(data.etaMinutes);
        }
      }
    }
  }, [lastEvent, booking.id, initialProvider]);

  const status = statusConfig[booking.status] || statusConfig.pending;
  const hasLocation = booking.location.latitude && booking.location.longitude;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Home
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Track Your Service</h1>
        <p className="text-muted-foreground">Booking #{booking.id.slice(0, 8)}</p>
      </div>

      {!isConnected && (booking.status === "dispatched" || booking.status === "in_progress") && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-sm text-yellow-800">
          <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
          Reconnecting to live updates...
        </div>
      )}

      {/* Status Banner */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`${status.color} text-white p-3 rounded-full`}>
                {status.icon}
              </div>
              <div>
                <p className="font-semibold text-lg">{status.label}</p>
                <p className="text-sm text-muted-foreground">{booking.serviceName}</p>
              </div>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              ${(booking.estimatedPrice / 100).toFixed(2)}
            </Badge>
          </div>

          {/* Progress Steps */}
          <div className="mt-6 flex justify-between">
            {["pending", "confirmed", "dispatched", "in_progress", "completed"].map((step, i) => {
              const stepIndex = ["pending", "confirmed", "dispatched", "in_progress", "completed"].indexOf(booking.status);
              const isCompleted = i <= stepIndex;
              const isCurrent = step === booking.status;
              return (
                <div key={step} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                      isCompleted
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    } ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  >
                    {i + 1}
                  </div>
                  <span className="text-xs mt-1 text-center hidden sm:block">
                    {step.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Map */}
      {hasLocation && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Live Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <LiveTrackingMap
              pickupLocation={{
                lat: booking.location.latitude!,
                lng: booking.location.longitude!,
              }}
              destinationLocation={
                booking.location.destinationLatitude && booking.location.destinationLongitude
                  ? {
                      lat: booking.location.destinationLatitude,
                      lng: booking.location.destinationLongitude,
                    }
                  : undefined
              }
              providerLocation={providerLocation}
              providerName={initialProvider?.name}
              className="h-[300px] w-full rounded-lg"
            />
            <div className="mt-3 flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Pickup</span>
              </div>
              {booking.location.destination && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Destination</span>
                </div>
              )}
              {providerLocation && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span>Provider</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Provider Info */}
        {initialProvider && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Provider</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {initialProvider.photoUrl ? (
                    <Image
                      src={initialProvider.photoUrl}
                      alt={initialProvider.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{initialProvider.name}</p>
                    {initialProvider.rating && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span>{initialProvider.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <a href={`tel:${initialProvider.phone}`}>
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </a>
                </Button>
              </div>
              {etaMinutes !== null && (booking.status === "dispatched" || booking.status === "in_progress") && (
                <div className="mt-3 p-3 bg-primary/5 rounded-lg flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Estimated arrival: {etaMinutes} min</p>
                </div>
              )}
              {providerLocation && (
                <p className="text-xs text-muted-foreground mt-2">
                  Last updated: {new Date(providerLocation.updatedAt).toLocaleTimeString()}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Vehicle Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vehicle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Car className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {booking.vehicleInfo.year} {booking.vehicleInfo.make} {booking.vehicleInfo.model}
                </p>
                <p className="text-sm text-muted-foreground">{booking.vehicleInfo.color}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pickup Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <p className="text-sm">{booking.location.address}</p>
            </div>
            {booking.location.destination && (
              <div className="flex items-start gap-3 mt-3 pt-3 border-t">
                <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Destination</p>
                  <p className="text-sm">{booking.location.destination}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Booking Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Booked</span>
              <span>{new Date(booking.createdAt).toLocaleString()}</span>
            </div>
            {booking.scheduledAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scheduled</span>
                <span>{new Date(booking.scheduledAt).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contact</span>
              <span>{booking.contactName}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Help */}
      <Card className="mt-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Need help with your booking?</p>
            <Button asChild variant="outline" size="sm">
              <a href={`tel:${BUSINESS.phone}`}>
                <Phone className="h-4 w-4 mr-2" />
                Call Support
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Review Section - Only for completed bookings */}
      {booking.status === "completed" && initialProvider && !hasReview && (
        <div id="review" className="mt-6">
          <ReviewForm
            bookingId={booking.id}
            providerName={initialProvider.name}
            onReviewSubmitted={() => setHasReview(true)}
          />
        </div>
      )}

      {/* Already Reviewed */}
      {booking.status === "completed" && hasReview && (
        <Card id="review" className="mt-6">
          <CardContent className="py-6 text-center">
            <Star className="h-8 w-8 text-yellow-400 mx-auto mb-2 fill-yellow-400" />
            <p className="text-muted-foreground">Thank you for reviewing this service!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

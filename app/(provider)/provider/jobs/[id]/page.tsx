"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusUpdater } from "@/components/provider/status-updater";
import { LocationTracker } from "@/components/provider/location-tracker";
import { AlertCircle, ArrowLeft, Loader2, Navigation, Phone, RefreshCw } from "lucide-react";
import type { BookingStatus } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";

interface JobDetail {
  booking: {
    id: string;
    status: BookingStatus;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    estimatedPrice: number;
    finalPrice: number | null;
    vehicleInfo: { year: string; make: string; model: string; color: string };
    location: { address: string; notes?: string; destination?: string };
    scheduledAt: string | null;
    notes: string | null;
    createdAt: string;
  };
  service: { name: string; description: string };
  payments: Array<{ id: string; method: string; status: string; amount: number }>;
}

export default function ProviderJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function fetchJob() {
    setLoading(true);
    setError(false);
    fetch(`/api/provider/jobs/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      })
      .then((data) => setJob(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchJob();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /><span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">
          {error ? "Failed to load job details. Please try again." : "Job not found."}
        </p>
        <Button variant="outline" size="sm" onClick={() => error ? fetchJob() : router.back()}>
          {error ? <><RefreshCw className="mr-2 h-4 w-4" />Retry</> : <><ArrowLeft className="mr-2 h-4 w-4" />Go Back</>}
        </Button>
      </div>
    );
  }

  const { booking, service, payments } = job;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl font-bold">Job #{booking.id.slice(0, 8)}</h1>
        <Badge variant="secondary">{booking.status.replace("_", " ")}</Badge>
      </div>

      <div className="flex items-center justify-between">
        <StatusUpdater
          bookingId={booking.id}
          currentStatus={booking.status}
          onStatusChange={(newStatus) => {
            setJob((prev) =>
              prev ? { ...prev, booking: { ...prev.booking, status: newStatus } } : prev
            );
          }}
        />
        <LocationTracker />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-medium">{booking.contactName}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <a href={`tel:${booking.contactPhone}`}>
                  <Phone className="mr-2 h-4 w-4" />
                  {booking.contactPhone}
                </a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{booking.contactEmail}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {booking.vehicleInfo.year} {booking.vehicleInfo.make} {booking.vehicleInfo.model}
            </p>
            <p className="text-sm text-muted-foreground">Color: {booking.vehicleInfo.color}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{service.name}</p>
            <p className="text-sm text-muted-foreground">{service.description}</p>
            <p className="text-lg font-bold">
              {formatPrice(booking.finalPrice || booking.estimatedPrice)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-medium">{booking.location.address}</p>
            {booking.location.destination && (
              <p className="text-sm">
                <span className="text-muted-foreground">Destination:</span> {booking.location.destination}
              </p>
            )}
            {booking.location.notes && (
              <p className="text-sm text-muted-foreground">{booking.location.notes}</p>
            )}
            {booking.notes && (
              <p className="text-sm text-muted-foreground">Notes: {booking.notes}</p>
            )}
            <Button asChild className="w-full" size="sm">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(booking.location.address)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Navigation className="mr-2 h-4 w-4" />
                Navigate to Customer
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b py-2 last:border-0">
                <div>
                  <span className="text-sm font-medium">{p.method}</span>
                  <Badge variant="outline" className="ml-2">
                    {p.status}
                  </Badge>
                </div>
                <span className="text-sm font-medium">{formatPrice(p.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

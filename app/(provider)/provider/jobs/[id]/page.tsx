"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusUpdater } from "@/components/provider/status-updater";
import { LocationTracker } from "@/components/provider/location-tracker";
import { ArrowLeft } from "lucide-react";
import type { BookingStatus } from "@/lib/constants";

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

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ProviderJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/provider/jobs/${params.id}`)
      .then((r) => r.json())
      .then((data) => setJob(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (!job) {
    return <p className="text-destructive">Job not found.</p>;
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
          <CardContent className="space-y-2">
            <p className="font-medium">{booking.contactName}</p>
            <p className="text-sm text-muted-foreground">{booking.contactPhone}</p>
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
          <CardContent className="space-y-2">
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

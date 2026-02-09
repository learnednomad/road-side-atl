import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { bookings, services, payments, providers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { BookingStatus, PaymentMethod } from "@/lib/constants";
import {
  ArrowLeft,
  Car,
  MapPin,
  User,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  FileText,
  Truck,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking Detail | Admin | RoadSide ATL",
};

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const results = await db
    .select({
      booking: bookings,
      service: services,
      payment: payments,
      provider: providers,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(payments, eq(payments.bookingId, bookings.id))
    .leftJoin(providers, eq(bookings.providerId, providers.id))
    .where(eq(bookings.id, id));

  if (results.length === 0) {
    notFound();
  }

  const booking = results[0].booking;
  const service = results[0].service;
  const provider = results[0].provider;
  const bookingPayments = results
    .filter((r) => r.payment)
    .map((r) => r.payment!)
    .filter(
      (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i
    );

  const vehicleInfo = booking.vehicleInfo as {
    year: string;
    make: string;
    model: string;
    color: string;
  };
  const location = booking.location as {
    address: string;
    destination?: string;
    notes?: string;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/bookings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Bookings
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Booking Detail</h1>
          <p className="text-sm text-muted-foreground">ID: {booking.id}</p>
        </div>
        <StatusBadge status={booking.status as BookingStatus} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{booking.contactName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a
                href={`tel:${booking.contactPhone}`}
                className="text-sm text-primary hover:underline"
              >
                {booking.contactPhone}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a
                href={`mailto:${booking.contactEmail}`}
                className="text-sm text-primary hover:underline"
              >
                {booking.contactEmail}
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Service Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Service
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{service.name}</p>
            <p className="text-sm text-muted-foreground capitalize">
              Category: {service.category}
            </p>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Estimated: {formatPrice(booking.estimatedPrice)}
              </span>
            </div>
            {booking.finalPrice && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">
                  Final: {formatPrice(booking.finalPrice)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vehicle Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Car className="h-4 w-4" />
              Vehicle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
            </p>
            <p className="text-sm text-muted-foreground">{vehicleInfo.color}</p>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{location.address}</p>
            {location.destination && (
              <p className="text-sm text-muted-foreground">
                Destination: {location.destination}
              </p>
            )}
            {location.notes && (
              <p className="text-sm text-muted-foreground">
                Notes: {location.notes}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Provider */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-4 w-4" />
              Provider
            </CardTitle>
          </CardHeader>
          <CardContent>
            {provider ? (
              <div className="space-y-1">
                <p className="font-medium">{provider.name}</p>
                <a
                  href={`tel:${provider.phone}`}
                  className="text-sm text-primary hover:underline"
                >
                  {provider.phone}
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not assigned</p>
            )}
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(booking.createdAt).toLocaleString()}</span>
            </div>
            {booking.scheduledAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scheduled</span>
                <span>
                  {new Date(booking.scheduledAt).toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated</span>
              <span>{new Date(booking.updatedAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bookingPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded.</p>
          ) : (
            <div className="space-y-2">
              {bookingPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        payment.status === "confirmed" ? "default" : "secondary"
                      }
                    >
                      {payment.status}
                    </Badge>
                    <span className="text-sm capitalize">{payment.method}</span>
                  </div>
                  <span className="font-medium">
                    {formatPrice(payment.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {booking.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{booking.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

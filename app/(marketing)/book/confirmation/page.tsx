import { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, Phone, MapPin, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaymentInstructions } from "@/components/booking/payment-instructions";
import { BUSINESS } from "@/lib/constants";
import { db } from "@/db";
import { bookings, services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking Confirmed | RoadSide ATL",
};

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string; paid?: string }>;
}) {
  const params = await searchParams;
  const bookingId = params.bookingId;
  const paid = params.paid === "true";

  if (!bookingId) {
    notFound();
  }

  let booking;
  let service;
  try {
    booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });
    if (booking) {
      service = await db.query.services.findFirst({
        where: eq(services.id, booking.serviceId),
      });
    }
  } catch {
    // DB not ready
  }

  if (!booking || !service) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <div className="mb-8 text-center">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <h1 className="mb-2 text-3xl font-bold">Booking Submitted</h1>
          {bookingId && (
            <p className="text-muted-foreground">
              Booking #{bookingId.slice(0, 8).toUpperCase()}
            </p>
          )}
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4 text-center">
            <p className="text-muted-foreground">
              Your booking has been received and is being processed. A team member will contact you shortly to confirm.
            </p>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium">Need immediate help? Call us:</p>
              <a
                href={`tel:${BUSINESS.phone}`}
                className="inline-flex items-center gap-2 text-lg font-semibold mt-1"
              >
                <Phone className="h-5 w-5" />
                {BUSINESS.phone}
              </a>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {bookingId && (
                <Button asChild className="flex-1">
                  <Link href={`/track/${bookingId}`}>
                    <MapPin className="mr-2 h-4 w-4" />
                    Track Booking
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" className="flex-1">
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isDiagnostics = service.category === "diagnostics";
  const vehicleInfo = booking.vehicleInfo as {
    year: string;
    make: string;
    model: string;
    color: string;
  };
  const location = booking.location as {
    address: string;
    notes?: string;
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <div className="mb-8 text-center">
        <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
        <h1 className="mb-2 text-3xl font-bold">Booking Received!</h1>
        <p className="text-muted-foreground">
          Booking #{bookingId.slice(0, 8).toUpperCase()}
        </p>
      </div>

      {/* Booking Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{service.name}</span>
            <Badge>{booking.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vehicle</span>
            <span>
              {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model} ({vehicleInfo.color})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Location</span>
            <span>{location.address}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Contact</span>
            <span>{booking.contactName} &middot; {booking.contactPhone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Schedule</span>
            <span>
              {booking.scheduledAt
                ? new Date(booking.scheduledAt).toLocaleString()
                : "ASAP"}
            </span>
          </div>
          <div className="flex justify-between border-t pt-3 text-base font-semibold">
            <span>Estimated Total</span>
            <span>{formatPrice(booking.estimatedPrice)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Instructions */}
      <PaymentInstructions
        isDiagnostics={isDiagnostics}
        estimatedPrice={booking.estimatedPrice}
        bookingId={booking.id}
        paid={paid}
      />

      {/* Next Steps */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button asChild className="flex-1">
          <Link href={`/track/${bookingId}`}>
            <MapPin className="mr-2 h-4 w-4" />
            Track Your Booking
          </Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href="/my-bookings">
            <ClipboardList className="mr-2 h-4 w-4" />
            View All Bookings
          </Link>
        </Button>
      </div>

      {/* Contact */}
      <Card className="mt-6">
        <CardContent className="pt-6 text-center">
          <p className="mb-2 text-sm text-muted-foreground">
            Questions about your booking?
          </p>
          <a
            href={`tel:${BUSINESS.phone}`}
            className="inline-flex items-center gap-2 text-lg font-semibold"
          >
            <Phone className="h-5 w-5" />
            {BUSINESS.phone}
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

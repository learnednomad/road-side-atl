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
import { auth } from "@/lib/auth";
import { captureServer } from "@/lib/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking Confirmed | RoadSide GA",
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

  const session = await auth();

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

  captureServer(ANALYTICS_EVENTS.BOOKING_CONFIRMATION_VIEWED, {
    distinctId: session?.user?.id ?? bookingId,
    booking_id: bookingId,
    paid,
    service_name: service?.name,
    service_slug: service?.slug,
    estimated_price: booking?.estimatedPrice,
  });

  if (!booking || !service) {
    return (
      <div className="min-h-screen bg-[#faf9f6]">
        <div className="container mx-auto max-w-2xl px-4 py-16">
          <div className="mb-8 text-center">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-600" />
            <h1 className="mb-2 text-3xl font-semibold tracking-tight text-neutral-950">Booking Submitted</h1>
            {bookingId && (
              <p className="font-mono text-sm text-neutral-500">
                Booking #{bookingId.slice(0, 8).toUpperCase()}
              </p>
            )}
          </div>
          <Card className="rounded-2xl border-neutral-200 bg-white">
            <CardContent className="pt-6 space-y-4 text-center">
              <p className="text-neutral-600">
                Your booking has been received and is being processed. A team member will contact you shortly to confirm.
              </p>
              <div className="rounded-xl border border-neutral-200 bg-[#faf9f6] p-4">
                <p className="text-sm font-medium text-neutral-950">Need immediate help? Call us:</p>
                <a
                  href={`tel:${BUSINESS.phone}`}
                  className="inline-flex items-center gap-2 font-mono text-lg font-semibold text-neutral-950 mt-1"
                >
                  <Phone className="h-5 w-5" />
                  {BUSINESS.phone}
                </a>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                {bookingId && (
                  <Button asChild className="flex-1 rounded-full">
                    <Link href={`/track/${bookingId}`}>
                      <MapPin className="mr-2 h-4 w-4" />
                      Track Booking
                    </Link>
                  </Button>
                )}
                <Button asChild variant="outline" className="flex-1 rounded-full border-neutral-300">
                  <Link href="/">Back to Home</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
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
    <div className="min-h-screen bg-[#faf9f6]">
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <div className="mb-8 text-center">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-600" />
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-neutral-950">Booking Received!</h1>
          <p className="font-mono text-sm text-neutral-500">
            Booking #{bookingId.slice(0, 8).toUpperCase()}
          </p>
        </div>

        {/* Booking Summary */}
        <Card className="mb-6 rounded-2xl border-neutral-200 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center justify-between font-semibold tracking-tight text-neutral-950">
              <span>{service.name}</span>
              <Badge>{booking.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">Vehicle</span>
              <span className="text-right text-neutral-950">
                {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model} ({vehicleInfo.color})
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">Location</span>
              <span className="text-right text-neutral-950">{location.address}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">Contact</span>
              <span className="text-right text-neutral-950">{booking.contactName} &middot; {booking.contactPhone}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">Service Mode</span>
              <span className="text-right text-neutral-950">
                {booking.scheduledAt
                  ? new Date(booking.scheduledAt).toLocaleString()
                  : "Immediate — dispatching now"}
              </span>
            </div>
            <div className="flex justify-between border-t border-neutral-200 pt-3 text-base font-semibold">
              <span className="text-neutral-950">Estimated Total</span>
              <span className="font-mono text-neutral-950">{formatPrice(booking.estimatedPrice)}</span>
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
          <Button asChild className="flex-1 rounded-full">
            <Link href={`/track/${bookingId}`}>
              <MapPin className="mr-2 h-4 w-4" />
              Track Your Booking
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1 rounded-full border-neutral-300">
            <Link href="/my-bookings">
              <ClipboardList className="mr-2 h-4 w-4" />
              View All Bookings
            </Link>
          </Button>
        </div>

        {/* Contact */}
        <Card className="mt-6 rounded-2xl border-neutral-200 bg-white">
          <CardContent className="pt-6 text-center">
            <p className="mb-2 text-sm text-neutral-500">
              Questions about your booking?
            </p>
            <a
              href={`tel:${BUSINESS.phone}`}
              className="inline-flex items-center gap-2 font-mono text-lg font-semibold text-neutral-950"
            >
              <Phone className="h-5 w-5" />
              {BUSINESS.phone}
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

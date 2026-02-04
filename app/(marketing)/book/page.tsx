import { Metadata } from "next";
import { Suspense } from "react";
import { BookingForm } from "@/components/booking/booking-form";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Book a Service | RoadSide ATL",
  description: "Book roadside assistance or car diagnostics in Atlanta.",
};

export default async function BookPage() {
  let allServices: any[] = [];
  try {
    allServices = await db
      .select()
      .from(services)
      .where(eq(services.active, true))
      .orderBy(services.name);
  } catch {
    allServices = [
      { id: "1", name: "Jump Start", slug: "jump-start", basePrice: 7500, pricePerMile: null, category: "roadside" },
      { id: "2", name: "Towing (Local)", slug: "towing", basePrice: 12500, pricePerMile: 600, category: "roadside" },
      { id: "3", name: "Lockout Service", slug: "lockout", basePrice: 7500, pricePerMile: null, category: "roadside" },
      { id: "4", name: "Flat Tire Change", slug: "flat-tire", basePrice: 10000, pricePerMile: null, category: "roadside" },
      { id: "5", name: "Fuel Delivery", slug: "fuel-delivery", basePrice: 7500, pricePerMile: null, category: "roadside" },
      { id: "6", name: "Car Purchase Diagnostics", slug: "car-purchase-diagnostics", basePrice: 25000, pricePerMile: null, category: "diagnostics" },
    ];
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold">Book a Service</h1>
      <p className="mb-8 text-muted-foreground">
        Fill out the details below and we&apos;ll get you taken care of.
      </p>
      <Suspense fallback={<div>Loading...</div>}>
        <BookingForm services={allServices} />
      </Suspense>
    </div>
  );
}

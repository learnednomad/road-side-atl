import { Metadata } from "next";
import { Suspense } from "react";
import { BookingForm } from "@/components/booking/booking-form";
import { buildMetadata } from "@/lib/seo";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export const metadata: Metadata = buildMetadata({
  title: "Book Roadside Assistance in Atlanta - Get Help Now",
  description:
    "Book 24/7 roadside assistance in Atlanta online. Towing, jump starts, lockout service, flat tire changes, fuel delivery & car diagnostics. Fast dispatch, affordable prices. Book now!",
  path: "/book",
  keywords: [
    "book roadside assistance Atlanta",
    "schedule towing Atlanta",
    "request roadside help Atlanta GA",
    "book jump start Atlanta",
    "emergency roadside booking Atlanta",
    "roadside assistance online booking",
  ],
});

export default async function BookPage() {
  const session = await auth();
  const userInfo = session?.user ? {
    name: session.user.name || "",
    email: session.user.email || "",
  } : undefined;

  type Service = {
    id: string;
    name: string;
    slug: string;
    description?: string;
    basePrice: number;
    pricePerMile: number | null;
    category: string;
  };

  let allServices: Service[] = [];
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
      { id: "6", name: "Basic Inspection", slug: "basic-inspection", description: "Essential pre-purchase check covering OBD2 scan, visual exterior/interior inspection, fluid levels, tire condition, and battery health.", basePrice: 15000, pricePerMile: null, category: "diagnostics" },
      { id: "7", name: "Standard Inspection", slug: "standard-inspection", description: "Comprehensive inspection including OBD2 diagnostics, brake system check, suspension test, electrical system review, engine performance analysis, and photo documentation.", basePrice: 25000, pricePerMile: null, category: "diagnostics" },
      { id: "8", name: "Premium Inspection", slug: "premium-inspection", description: "Complete diagnostic report with full mechanical inspection, detailed OBD2 code analysis, test drive evaluation, undercarriage examination, emissions check, and branded PDF report with repair cost estimates.", basePrice: 39900, pricePerMile: null, category: "diagnostics" },
    ];
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold">Book Roadside Assistance in Atlanta</h1>
      <p className="mb-8 text-muted-foreground">
        Select your service and location below. We&apos;ll dispatch a technician to you fast.
      </p>
      <Suspense fallback={<div>Loading...</div>}>
        <BookingForm services={allServices} userInfo={userInfo} />
      </Suspense>
    </div>
  );
}

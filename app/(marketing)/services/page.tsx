import { Metadata } from "next";
import { ServiceCard } from "@/components/marketing/service-card";
import { buildMetadata, SITE_URL } from "@/lib/seo";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = buildMetadata({
  title: "Roadside Assistance Services Atlanta GA - Towing, Jump Start, Lockout & More",
  description:
    "Full range of 24/7 roadside assistance services in Atlanta: towing, battery jump starts, car lockout, flat tire change, fuel delivery & pre-purchase car diagnostics. Affordable prices starting at $75. Book now!",
  path: "/services",
  keywords: [
    "roadside assistance services Atlanta",
    "towing service Atlanta GA",
    "jump start service Atlanta",
    "car lockout service Atlanta",
    "flat tire change Atlanta",
    "fuel delivery service Atlanta",
    "car diagnostics Atlanta GA",
    "pre-purchase car inspection Atlanta",
    "OBD2 scan Atlanta",
    "emergency roadside services near me",
    "affordable towing Atlanta",
    "24/7 roadside services Atlanta",
  ],
});

export default async function ServicesPage() {
  type Service = {
    name: string;
    slug: string;
    description: string;
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
      { name: "Jump Start", slug: "jump-start", description: "Dead battery? We'll get you running again with a professional jump start.", basePrice: 7500, pricePerMile: null, category: "roadside" },
      { name: "Towing (Local)", slug: "towing", description: "Local towing within Atlanta. Base rate includes first 10 miles, $6/mile beyond.", basePrice: 12500, pricePerMile: 600, category: "roadside" },
      { name: "Lockout Service", slug: "lockout", description: "Locked out of your car? Our technicians will safely get you back in.", basePrice: 7500, pricePerMile: null, category: "roadside" },
      { name: "Flat Tire Change", slug: "flat-tire", description: "We'll swap your flat for your spare tire and get you back on the road.", basePrice: 10000, pricePerMile: null, category: "roadside" },
      { name: "Fuel Delivery", slug: "fuel-delivery", description: "Ran out of gas? We'll bring enough fuel to get you to the nearest station.", basePrice: 7500, pricePerMile: null, category: "roadside" },
      { name: "Basic Inspection", slug: "basic-inspection", description: "Essential pre-purchase check covering OBD2 scan, visual exterior/interior inspection, fluid levels, tire condition, and battery health.", basePrice: 15000, pricePerMile: null, category: "diagnostics" },
      { name: "Standard Inspection", slug: "standard-inspection", description: "Comprehensive inspection including OBD2 diagnostics, brake system check, suspension test, electrical system review, engine performance analysis, and photo documentation.", basePrice: 25000, pricePerMile: null, category: "diagnostics" },
      { name: "Premium Inspection", slug: "premium-inspection", description: "Complete diagnostic report with full mechanical inspection, detailed OBD2 code analysis, test drive evaluation, undercarriage examination, emissions check, and branded PDF report with repair cost estimates.", basePrice: 39900, pricePerMile: null, category: "diagnostics" },
    ];
  }

  const roadsideServices = allServices.filter((s) => s.category === "roadside");
  const diagnosticsServices = allServices.filter((s) => s.category === "diagnostics");

  return (
    <div className="container mx-auto px-4 py-16">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: SITE_URL },
          { name: "Services", url: `${SITE_URL}/services` },
        ]}
      />

      <h1 className="mb-2 text-3xl font-bold">
        Roadside Assistance & Vehicle Diagnostic Services in Atlanta
      </h1>
      <p className="mb-10 text-muted-foreground">
        Professional 24/7 roadside assistance and comprehensive vehicle diagnostics
        serving the entire Atlanta metro area. Affordable, fast, and reliable.
      </p>

      <h2
        className="mb-6 border-l-4 border-red-600 pl-4 text-2xl font-semibold"
        id="roadside"
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-600" />
          24/7 Emergency Roadside Assistance in Atlanta
        </div>
      </h2>
      <div className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {roadsideServices.map((service) => (
          <ServiceCard key={service.slug} {...service} />
        ))}
      </div>

      <h2
        className="mb-6 border-l-4 border-red-600 pl-4 text-2xl font-semibold"
        id="diagnostics"
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-600" />
          Pre-Purchase Vehicle Diagnostics in Atlanta
        </div>
      </h2>
      <div className="grid gap-6 sm:grid-cols-2">
        {diagnosticsServices.map((service) => (
          <ServiceCard key={service.slug} {...service} />
        ))}
      </div>
    </div>
  );
}

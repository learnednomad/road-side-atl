import { Metadata } from "next";
import { ServiceCard } from "@/components/marketing/service-card";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Services | RoadSide ATL",
  description: "Roadside assistance and car purchase diagnostic services in Atlanta.",
};

export default async function ServicesPage() {
  let allServices: any[] = [];
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
      { name: "Car Purchase Diagnostics", slug: "car-purchase-diagnostics", description: "Comprehensive pre-purchase vehicle inspection with OBD2 scan and mechanical grade assessment. Full payment required upfront.", basePrice: 25000, pricePerMile: null, category: "diagnostics" },
    ];
  }

  const roadsideServices = allServices.filter((s) => s.category === "roadside");
  const diagnosticsServices = allServices.filter((s) => s.category === "diagnostics");

  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold">Our Services</h1>
      <p className="mb-10 text-muted-foreground">
        Professional roadside assistance and vehicle diagnostics across the Atlanta metro area.
      </p>

      <h2 className="mb-6 text-2xl font-semibold">Roadside Assistance</h2>
      <div className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {roadsideServices.map((service) => (
          <ServiceCard key={service.slug} {...service} />
        ))}
      </div>

      <h2 className="mb-6 text-2xl font-semibold">Vehicle Diagnostics</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {diagnosticsServices.map((service) => (
          <ServiceCard key={service.slug} {...service} />
        ))}
      </div>
    </div>
  );
}

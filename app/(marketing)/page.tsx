import Link from "next/link";
import { ArrowRight, Clock, MapPin, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Hero } from "@/components/marketing/hero";
import { ServiceCard } from "@/components/marketing/service-card";
import { BUSINESS } from "@/lib/constants";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function HomePage() {
  let allServices: any[] = [];
  try {
    allServices = await db
      .select()
      .from(services)
      .where(eq(services.active, true))
      .orderBy(services.name);
  } catch {
    // DB not available yet — show static fallback
    allServices = [
      { name: "Jump Start", slug: "jump-start", description: "Dead battery? We'll get you running again.", basePrice: 7500, pricePerMile: null, category: "roadside" },
      { name: "Towing (Local)", slug: "towing", description: "Local towing within the Atlanta metro area.", basePrice: 12500, pricePerMile: 600, category: "roadside" },
      { name: "Lockout Service", slug: "lockout", description: "Locked out? We'll safely get you back in.", basePrice: 7500, pricePerMile: null, category: "roadside" },
      { name: "Flat Tire Change", slug: "flat-tire", description: "We'll swap your flat for your spare tire.", basePrice: 10000, pricePerMile: null, category: "roadside" },
      { name: "Fuel Delivery", slug: "fuel-delivery", description: "We'll bring fuel to get you to a station.", basePrice: 7500, pricePerMile: null, category: "roadside" },
      { name: "Car Purchase Diagnostics", slug: "car-purchase-diagnostics", description: "Comprehensive pre-purchase inspection with OBD2 scan.", basePrice: 25000, pricePerMile: null, category: "diagnostics" },
    ];
  }

  return (
    <>
      <Hero />

      {/* Services Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-2 text-center text-3xl font-bold">Our Services</h2>
          <p className="mb-10 text-center text-muted-foreground">
            Professional roadside assistance and vehicle diagnostics
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {allServices.map((service) => (
              <ServiceCard key={service.slug} {...service} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-10 text-center text-3xl font-bold">How It Works</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Clock,
                title: "1. Book Your Service",
                desc: "Choose your service and tell us where you are. Book online or call us directly.",
              },
              {
                icon: MapPin,
                title: "2. We Come to You",
                desc: "Our technician is dispatched to your location across the Atlanta metro area.",
              },
              {
                icon: DollarSign,
                title: "3. Pay Your Way",
                desc: "Pay with Cash, CashApp, or Zelle after service. Card payments also accepted.",
              },
            ].map((step) => (
              <Card key={step.title}>
                <CardContent className="pt-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Service Area */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold">Serving All of Atlanta</h2>
          <p className="mx-auto mb-6 max-w-xl text-muted-foreground">
            We cover the entire {BUSINESS.serviceArea}, including Buckhead, Midtown,
            Downtown, Decatur, Marietta, Sandy Springs, and surrounding areas.
          </p>
          <Link href="/book">
            <Button size="lg">
              Book a Service
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}

import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, MapPin, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Hero } from "@/components/marketing/hero";
import { ServiceCard } from "@/components/marketing/service-card";
import { BUSINESS } from "@/lib/constants";
import { buildMetadata, SITE_URL } from "@/lib/seo";
import {
  LocalBusinessJsonLd,
  FAQJsonLd,
  WebSiteJsonLd,
  BreadcrumbJsonLd,
} from "@/components/seo/json-ld";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = buildMetadata({
  title:
    "RoadSide ATL | 24/7 Roadside Assistance Atlanta GA - Towing, Jump Start, Lockout",
  description:
    "Need roadside help in Atlanta? RoadSide ATL provides 24/7 emergency towing, jump starts, lockout service, flat tire changes, fuel delivery & car diagnostics across metro Atlanta. Fast response, affordable prices. Call now!",
  path: "",
  keywords: [
    "roadside assistance Atlanta",
    "24/7 roadside assistance Atlanta GA",
    "emergency roadside help Atlanta",
    "towing Atlanta",
    "jump start Atlanta",
    "lockout service Atlanta",
    "flat tire change Atlanta",
    "fuel delivery Atlanta",
    "car diagnostics Atlanta",
    "roadside assistance near me",
  ],
});

const HOMEPAGE_FAQS = [
  {
    question: "How fast can you get to me in Atlanta?",
    answer:
      "We aim to reach you as quickly as possible within the Atlanta metro area. Our dispatched technicians are strategically located across ITP and OTP to minimize wait times.",
  },
  {
    question: "What areas do you serve in Atlanta?",
    answer:
      "We serve the entire Atlanta metro area including Buckhead, Midtown, Downtown, Decatur, Marietta, Sandy Springs, Roswell, Alpharetta, Dunwoody, Brookhaven, and surrounding areas — both Inside the Perimeter (ITP) and Outside the Perimeter (OTP).",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept Cash, CashApp, Zelle, and credit/debit cards. Payment is collected after service is completed (except for Car Purchase Diagnostics which requires upfront payment).",
  },
  {
    question: "How much does roadside assistance cost in Atlanta?",
    answer:
      "Our services start at $75 for jump starts, lockout service, and fuel delivery. Flat tire changes start at $100. Towing starts at $125 (includes first 10 miles, $6/mile after). Car Purchase Diagnostics are $250.",
  },
  {
    question: "Do you offer 24/7 emergency roadside assistance?",
    answer:
      "Yes! RoadSide ATL provides 24/7 emergency roadside assistance across the entire Atlanta metro area. Whether it's day or night, weekday or weekend, we're here to help.",
  },
  {
    question: "What roadside services do you offer in Atlanta?",
    answer:
      "We offer jump starts, local towing, lockout service, flat tire changes, fuel delivery, and comprehensive pre-purchase car diagnostics with OBD2 scanning across the Atlanta metro area.",
  },
];

const STEPS = [
  {
    num: 1,
    icon: Clock,
    title: "Book Your Service",
    desc: "Choose your service and tell us where you are. Book online in minutes or call us directly for immediate assistance.",
  },
  {
    num: 2,
    icon: MapPin,
    title: "We Come to You",
    desc: "Our trained technician is dispatched to your exact location anywhere in the Atlanta metro area — ITP or OTP.",
  },
  {
    num: 3,
    icon: DollarSign,
    title: "Pay Your Way",
    desc: "Pay with Cash, CashApp, Zelle, or card after service is completed. Transparent pricing, no hidden fees.",
  },
];

export default async function HomePage() {
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
    // DB not available yet — show static fallback
    allServices = [
      { name: "Jump Start", slug: "jump-start", description: "Dead battery? We'll get you running again.", basePrice: 7500, pricePerMile: null, category: "roadside" },
      { name: "Towing (Local)", slug: "towing", description: "Local towing within the Atlanta metro area.", basePrice: 12500, pricePerMile: 600, category: "roadside" },
      { name: "Lockout Service", slug: "lockout", description: "Locked out? We'll safely get you back in.", basePrice: 7500, pricePerMile: null, category: "roadside" },
      { name: "Flat Tire Change", slug: "flat-tire", description: "We'll swap your flat for your spare tire.", basePrice: 10000, pricePerMile: null, category: "roadside" },
      { name: "Fuel Delivery", slug: "fuel-delivery", description: "We'll bring fuel to get you to a station.", basePrice: 7500, pricePerMile: null, category: "roadside" },
      { name: "Basic Inspection", slug: "basic-inspection", description: "Essential pre-purchase check covering OBD2 scan, visual exterior/interior inspection, fluid levels, tire condition, and battery health.", basePrice: 15000, pricePerMile: null, category: "diagnostics" },
      { name: "Standard Inspection", slug: "standard-inspection", description: "Comprehensive inspection including OBD2 diagnostics, brake system check, suspension test, electrical system review, engine performance analysis, and photo documentation.", basePrice: 25000, pricePerMile: null, category: "diagnostics" },
      { name: "Premium Inspection", slug: "premium-inspection", description: "Complete diagnostic report with full mechanical inspection, detailed OBD2 code analysis, test drive evaluation, undercarriage examination, emissions check, and branded PDF report with repair cost estimates.", basePrice: 39900, pricePerMile: null, category: "diagnostics" },
    ];
  }

  return (
    <>
      {/* Structured Data */}
      <LocalBusinessJsonLd />
      <WebSiteJsonLd />
      <FAQJsonLd faqs={HOMEPAGE_FAQS} />
      <BreadcrumbJsonLd
        items={[{ name: "Home", url: SITE_URL }]}
      />

      <Hero />

      {/* Services Grid */}
      <section className="animate-on-scroll py-16" id="services" aria-labelledby="services-heading">
        <div className="container mx-auto px-4">
          <h2 id="services-heading" className="mb-2 text-center text-3xl font-bold">
            Roadside Assistance Services in Atlanta
          </h2>
          <span className="mx-auto mt-2 block h-1 w-20 rounded bg-red-600" />
          <p className="mb-10 mt-4 text-center text-muted-foreground">
            Professional 24/7 roadside assistance and vehicle diagnostics across the Atlanta metro area
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {allServices.map((service) => (
              <ServiceCard key={service.slug} {...service} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="animate-on-scroll bg-muted/50 py-16" aria-labelledby="how-it-works-heading">
        <div className="container mx-auto px-4">
          <h2 id="how-it-works-heading" className="mb-10 text-center text-3xl font-bold">
            How Our Atlanta Roadside Assistance Works
          </h2>
          <div className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Connector line (desktop only) */}
            <div className="pointer-events-none absolute left-0 right-0 top-[3.25rem] hidden h-0.5 bg-red-600/20 lg:block" />
            {STEPS.map((step) => (
              <Card key={step.num} className="card-hover-glow relative">
                <CardContent className="pt-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-lg font-bold text-white">
                    {step.num}
                  </div>
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-600/10">
                    <step.icon className="h-5 w-5 text-red-600" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Service Area - keyword rich for local SEO */}
      <section className="animate-on-scroll bg-red-600/5 py-16" aria-labelledby="service-area-heading">
        <div className="container mx-auto px-4 text-center">
          <h2 id="service-area-heading" className="mb-4 text-3xl font-bold">
            Roadside Assistance Across All of Atlanta
          </h2>
          <p className="mx-auto mb-6 max-w-2xl text-muted-foreground">
            We cover the entire {BUSINESS.serviceArea}. Our roadside assistance technicians
            serve Buckhead, Midtown, Downtown Atlanta, Decatur, Marietta, Sandy Springs,
            Roswell, Alpharetta, Dunwoody, Brookhaven, and all surrounding communities.
            Stranded on I-285, I-85, I-75, or I-20? We&apos;ll be there fast.
          </p>
          <Button asChild size="lg">
            <Link href="/book">
              Get Roadside Help Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* FAQ Section - directly boosts SEO with FAQ schema */}
      <section className="animate-on-scroll bg-muted/50 py-16" aria-labelledby="faq-heading">
        <div className="container mx-auto max-w-3xl px-4">
          <h2 id="faq-heading" className="mb-10 text-center text-3xl font-bold">
            Frequently Asked Questions About Roadside Assistance in Atlanta
          </h2>
          <div className="space-y-4">
            {HOMEPAGE_FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-lg border bg-background p-4 transition-colors marker:text-red-600 hover:border-red-600/20 open:border-red-600/30"
              >
                <summary className="cursor-pointer text-lg font-semibold">
                  {faq.question}
                </summary>
                <p className="mt-3 text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

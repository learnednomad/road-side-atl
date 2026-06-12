import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/marketing/hero";
import { ScenarioCards } from "@/components/marketing/scenario-cards";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { TrustSection } from "@/components/marketing/trust-section";
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
    "RoadSide GA | 24/7 Roadside Assistance Atlanta GA - Towing, Jump Start, Lockout",
  description:
    "Need roadside help in Atlanta? RoadSide GA provides 24/7 emergency towing, jump starts, lockout service, flat tire changes, fuel delivery & car diagnostics across metro Atlanta. Fast response, affordable prices. Call now!",
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
      "Yes! RoadSide GA provides 24/7 emergency roadside assistance across the entire Atlanta metro area. Whether it's day or night, weekday or weekend, we're here to help.",
  },
  {
    question: "What roadside services do you offer in Atlanta?",
    answer:
      "We offer jump starts, local towing, lockout service, flat tire changes, fuel delivery, and comprehensive pre-purchase car diagnostics with OBD2 scanning across the Atlanta metro area.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Book Your Service",
    desc: "Choose your service and tell us where you are. Book online in minutes or call us directly for immediate assistance.",
  },
  {
    num: "02",
    title: "We Come to You",
    desc: "Our trained technician is dispatched to your exact location anywhere in the Atlanta metro area — ITP or OTP.",
  },
  {
    num: "03",
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

      <ScenarioCards />

      {/* Services Grid */}
      <section className="border-b bg-[#faf9f6]" id="services" aria-labelledby="services-heading">
        <div className="container mx-auto px-4 py-20">
          <SectionHeading
            kicker="Services"
            title="Roadside Assistance Services in Atlanta"
            id="services-heading"
          />
          <p className="-mt-8 mb-10 max-w-xl text-neutral-600">
            Professional 24/7 roadside assistance and vehicle diagnostics across the
            Atlanta metro area
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allServices.map((service) => (
              <ServiceCard key={service.slug} {...service} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works — numbered editorial rows */}
      <section className="border-b bg-[#faf9f6]" aria-labelledby="how-it-works-heading">
        <div className="container mx-auto px-4 py-20">
          <SectionHeading
            kicker="How it works"
            title="How Our Atlanta Roadside Assistance Works"
            id="how-it-works-heading"
          />
          <div>
            {STEPS.map((step) => (
              <div
                key={step.num}
                className="grid gap-3 border-t border-neutral-200 py-8 md:grid-cols-[6rem_1fr_1.2fr] md:gap-8"
              >
                <p className="font-mono text-sm text-neutral-400">{step.num}</p>
                <h3 className="text-xl font-semibold tracking-tight text-neutral-950">
                  {step.title}
                </h3>
                <p className="text-neutral-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PricingCards />

      <TrustSection />

      {/* Service Area - keyword rich for local SEO */}
      <section className="border-b bg-[#faf9f6]" aria-labelledby="service-area-heading">
        <div className="container mx-auto px-4 py-20">
          <SectionHeading
            kicker="Coverage"
            title="Roadside Assistance Across All of Atlanta"
            id="service-area-heading"
          />
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr] md:gap-16">
            <p className="-mt-6 max-w-2xl text-lg leading-relaxed text-neutral-600">
              We cover the entire {BUSINESS.serviceArea}. Our roadside assistance
              technicians serve Buckhead, Midtown, Downtown Atlanta, Decatur, Marietta,
              Sandy Springs, Roswell, Alpharetta, Dunwoody, Brookhaven, and all
              surrounding communities. Stranded on I-285, I-85, I-75, or I-20?
              We&apos;ll be there fast.
            </p>
            <div className="flex flex-col items-start gap-4">
              <Link
                href="/book"
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-7 py-4 font-mono text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-red-700"
              >
                Get Help Now
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
              <Link
                href="/become-provider"
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-neutral-950"
              >
                Want to earn with us? Become a provider
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section - directly boosts SEO with FAQ schema */}
      <section className="bg-[#faf9f6]" aria-labelledby="faq-heading">
        <div className="container mx-auto px-4 py-20">
          <SectionHeading
            kicker="FAQ"
            title="Frequently Asked Questions About Roadside Assistance in Atlanta"
            id="faq-heading"
          />
          <div className="mx-auto">
            {HOMEPAGE_FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group border-t border-neutral-200 py-5 open:pb-7"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-lg font-medium text-neutral-950 marker:content-none [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <span
                    aria-hidden
                    className="font-mono text-xl text-neutral-400 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-4 max-w-3xl text-neutral-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

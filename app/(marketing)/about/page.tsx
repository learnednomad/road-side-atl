import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { SectionHeading } from "@/components/marketing/section-heading";
import { BUSINESS } from "@/lib/constants";
import { buildMetadata, SITE_URL } from "@/lib/seo";
import { LocalBusinessJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = buildMetadata({
  title: "About RoadSide GA - Atlanta's Trusted Roadside Assistance Company",
  description:
    "Learn about RoadSide GA — Atlanta's trusted 24/7 roadside assistance provider. Fast response, professional technicians, serving Buckhead, Midtown, Decatur, Marietta & all metro Atlanta. Towing, jump starts, lockouts & more.",
  path: "/about",
  keywords: [
    "about RoadSide GA",
    "Atlanta roadside assistance company",
    "trusted towing company Atlanta",
    "roadside help provider Atlanta GA",
    "emergency roadside company Atlanta",
    "Atlanta auto service provider",
  ],
});

const WHY_POINTS = [
  {
    title: "Fast Response Times",
    desc: "We arrive quickly so you can get back on the road. Our technicians are strategically located across metro Atlanta for rapid dispatch.",
  },
  {
    title: "Trusted Professionals",
    desc: "Our experienced technicians are fully equipped to handle any roadside emergency — from dead batteries to lockouts to towing.",
  },
  {
    title: "All Atlanta Metro Coverage",
    desc: `We serve the entire ${BUSINESS.serviceArea}, including Buckhead, Midtown, Downtown, Decatur, Marietta, Sandy Springs, Roswell, and more.`,
  },
  {
    title: "Easy Booking & Payment",
    desc: "Book online in minutes or call us directly. Pay your way — Cash, CashApp, Zelle, or credit/debit card.",
  },
];

export default function AboutPage() {
  return (
    <div className="bg-[#faf9f6]">
      <div className="container mx-auto px-4 py-16">
        <LocalBusinessJsonLd />
        <BreadcrumbJsonLd
          items={[
            { name: "Home", url: SITE_URL },
            { name: "About", url: `${SITE_URL}/about` },
          ]}
        />

        <div className="mx-auto max-w-3xl">
          <p className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">
            <span aria-hidden className="h-3 w-0.5 bg-red-600" />
            About
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl">
            About {BUSINESS.name} — Atlanta&apos;s Trusted Roadside Assistance
          </h1>
          <p className="mt-4 mb-10 text-lg text-neutral-600">
            {BUSINESS.tagline}. Professional, reliable 24/7 roadside assistance
            when you need it most across the entire Atlanta metro area.
          </p>

          <div className="mb-16 space-y-6 leading-relaxed text-neutral-600">
            <p>
              {BUSINESS.name} provides fast, dependable roadside assistance and
              pre-purchase vehicle diagnostics across the{" "}
              {BUSINESS.serviceArea}. Whether you&apos;re stranded with a dead
              battery on I-285, locked out of your car in Buckhead, or need a tow
              in Midtown, our trained technicians are ready to help 24 hours a day,
              7 days a week.
            </p>
            <p>
              We also offer comprehensive car purchase diagnostics with OBD2
              scanning, giving you peace of mind before you buy a used vehicle
              anywhere in the Atlanta area.
            </p>
          </div>

          <SectionHeading kicker="Why us" title="Why Atlanta Chooses RoadSide GA" />
          <div className="mb-16">
            {WHY_POINTS.map((item, idx) => (
              <div
                key={item.title}
                className="grid gap-2 border-t border-neutral-200 py-7 md:grid-cols-[4rem_1fr_1.6fr] md:gap-6"
              >
                <p className="font-mono text-sm text-neutral-400">
                  {String(idx + 1).padStart(2, "0")}
                </p>
                <h3 className="font-semibold tracking-tight text-neutral-950">{item.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-600">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-neutral-950 p-10 text-white">
            <h2 className="text-2xl font-semibold tracking-tight">
              Need Roadside Assistance Now?
            </h2>
            <p className="mt-2 max-w-md text-neutral-300">
              We&apos;re ready to assist you 24/7 across the entire Atlanta metro
              area. Book online or call for immediate help.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/book"
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-7 py-4 font-mono text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-red-500"
              >
                Book a Service
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
              <a
                href={`tel:${BUSINESS.phone}`}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-700 px-7 py-4 font-mono text-sm font-medium uppercase tracking-wider text-white transition-colors hover:border-neutral-500"
              >
                <Phone aria-hidden className="h-4 w-4" />
                {BUSINESS.phone}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

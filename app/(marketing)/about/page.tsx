import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Phone, Shield, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BUSINESS } from "@/lib/constants";
import { buildMetadata, SITE_URL } from "@/lib/seo";
import { LocalBusinessJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = buildMetadata({
  title: "About RoadSide ATL - Atlanta's Trusted Roadside Assistance Company",
  description:
    "Learn about RoadSide ATL — Atlanta's trusted 24/7 roadside assistance provider. Fast response, professional technicians, serving Buckhead, Midtown, Decatur, Marietta & all metro Atlanta. Towing, jump starts, lockouts & more.",
  path: "/about",
  keywords: [
    "about RoadSide ATL",
    "Atlanta roadside assistance company",
    "trusted towing company Atlanta",
    "roadside help provider Atlanta GA",
    "emergency roadside company Atlanta",
    "Atlanta auto service provider",
  ],
});

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <LocalBusinessJsonLd />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: SITE_URL },
          { name: "About", url: `${SITE_URL}/about` },
        ]}
      />

      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-3xl font-bold">
          About {BUSINESS.name} — Atlanta&apos;s Trusted Roadside Assistance
        </h1>
        <p className="mb-10 text-lg text-muted-foreground">
          {BUSINESS.tagline}. Professional, reliable 24/7 roadside assistance
          when you need it most across the entire Atlanta metro area.
        </p>

        <div className="mb-12 space-y-6 text-muted-foreground">
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

        <h2 className="mb-6 text-2xl font-semibold">
          Why Atlanta Chooses RoadSide ATL
        </h2>
        <div className="mb-12 grid gap-6 sm:grid-cols-2">
          {[
            {
              icon: Clock,
              title: "Fast Response Times",
              desc: "We arrive quickly so you can get back on the road. Our technicians are strategically located across metro Atlanta for rapid dispatch.",
            },
            {
              icon: Shield,
              title: "Trusted Professionals",
              desc: "Our experienced technicians are fully equipped to handle any roadside emergency — from dead batteries to lockouts to towing.",
            },
            {
              icon: MapPin,
              title: "All Atlanta Metro Coverage",
              desc: `We serve the entire ${BUSINESS.serviceArea}, including Buckhead, Midtown, Downtown, Decatur, Marietta, Sandy Springs, Roswell, and more.`,
            },
            {
              icon: Phone,
              title: "Easy Booking & Payment",
              desc: "Book online in minutes or call us directly. Pay your way — Cash, CashApp, Zelle, or credit/debit card.",
            },
          ].map((item) => (
            <Card key={item.title}>
              <CardContent className="pt-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-1 font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="rounded-lg bg-muted/50 p-8 text-center">
          <h2 className="mb-2 text-2xl font-semibold">
            Need Roadside Assistance Now?
          </h2>
          <p className="mb-6 text-muted-foreground">
            We&apos;re ready to assist you 24/7 across the entire Atlanta metro
            area. Book online or call for immediate help.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/book">
                Book a Service
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href={`tel:${BUSINESS.phone}`}>
                <Phone className="mr-2 h-4 w-4" />
                {BUSINESS.phone}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

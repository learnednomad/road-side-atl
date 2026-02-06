import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Phone, Shield, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BUSINESS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About | RoadSide ATL",
  description:
    "Learn about RoadSide ATL — Atlanta's premium roadside assistance and vehicle diagnostics service.",
};

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-3xl font-bold">About {BUSINESS.name}</h1>
        <p className="mb-10 text-lg text-muted-foreground">
          {BUSINESS.tagline}. Professional, reliable service when you need it
          most.
        </p>

        <div className="mb-12 space-y-6 text-muted-foreground">
          <p>
            {BUSINESS.name} provides fast, dependable roadside assistance and
            pre-purchase vehicle diagnostics across the{" "}
            {BUSINESS.serviceArea}. Whether you&apos;re stranded with a dead
            battery, locked out of your car, or need a tow, our trained
            technicians are ready to help.
          </p>
          <p>
            We also offer comprehensive car purchase diagnostics with OBD2
            scanning, giving you peace of mind before you buy a used vehicle.
          </p>
        </div>

        <h2 className="mb-6 text-2xl font-semibold">Why Choose Us</h2>
        <div className="mb-12 grid gap-6 sm:grid-cols-2">
          {[
            {
              icon: Clock,
              title: "Fast Response",
              desc: "We arrive quickly so you can get back on the road without long waits.",
            },
            {
              icon: Shield,
              title: "Trusted Professionals",
              desc: "Our technicians are experienced and equipped to handle any roadside situation.",
            },
            {
              icon: MapPin,
              title: "Atlanta-Wide Coverage",
              desc: `We serve the entire ${BUSINESS.serviceArea}, including Buckhead, Midtown, Decatur, Marietta, and more.`,
            },
            {
              icon: Phone,
              title: "Easy Booking",
              desc: "Book online in minutes or call us directly. Pay with Cash, CashApp, Zelle, or card.",
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
          <h2 className="mb-2 text-2xl font-semibold">Need Help Now?</h2>
          <p className="mb-6 text-muted-foreground">
            We&apos;re ready to assist you across the Atlanta metro area.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/book">
              <Button size="lg">
                Book a Service
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a href={`tel:${BUSINESS.phone}`}>
              <Button variant="outline" size="lg">
                <Phone className="mr-2 h-4 w-4" />
                {BUSINESS.phone}
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

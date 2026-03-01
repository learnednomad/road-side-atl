import Link from "next/link";
import { Phone, ArrowRight, Shield, Clock, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESS } from "@/lib/constants";

const stats = [
  { icon: Clock, metric: "24/7", label: "Service" },
  { icon: Shield, metric: "30 min", label: "Response" },
  { icon: MapPin, metric: "Atlanta", label: "Metro-Wide" },
  { icon: Star, metric: "500+", label: "Rescues" },
];

export function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-gradient-to-b from-red-50 via-red-50/50 to-transparent py-16 md:py-24"
      aria-label="Hero"
    >
      <div className="container mx-auto px-4">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Left column — text & CTAs */}
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Available 24/7 in Atlanta
            </p>
            <h1 className="mb-6 text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl">
              Roadside Assistance in{" "}
              <span className="text-red-600">Atlanta, GA</span>
            </h1>
            <p className="mb-8 max-w-xl text-lg text-muted-foreground md:text-xl">
              Fast, reliable emergency roadside help — towing, jump starts,
              lockouts, flat tires, fuel delivery & vehicle diagnostics across
              the {BUSINESS.serviceArea}.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="text-lg">
                <Link href="/book">
                  Get Roadside Help Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg">
                <a
                  href={`tel:${BUSINESS.phone}`}
                  aria-label={`Call us at ${BUSINESS.phone}`}
                >
                  <Phone className="mr-2 h-5 w-5" />
                  Call {BUSINESS.phone}
                </a>
              </Button>
            </div>
          </div>

          {/* Right column — stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="card-hover-glow rounded-2xl border bg-background/80 p-5 text-center backdrop-blur transition-transform hover:-translate-y-0.5"
              >
                <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-red-600/10">
                  <stat.icon
                    className="h-5 w-5 text-red-600"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-xl font-bold sm:text-2xl">{stat.metric}</p>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

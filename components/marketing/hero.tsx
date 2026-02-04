import Link from "next/link";
import { Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESS } from "@/lib/constants";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background py-20 md:py-32">
      <div className="container mx-auto px-4 text-center">
        <h1 className="mb-6 text-4xl font-extrabold tracking-tight md:text-6xl">
          {BUSINESS.tagline}
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
          Fast, reliable roadside help and pre-purchase vehicle diagnostics across the{" "}
          {BUSINESS.serviceArea}. Available when you need us most.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/book">
            <Button size="lg" className="text-lg">
              Get Help Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <a href={`tel:${BUSINESS.phone}`}>
            <Button size="lg" variant="outline" className="text-lg">
              <Phone className="mr-2 h-5 w-5" />
              Call {BUSINESS.phone}
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

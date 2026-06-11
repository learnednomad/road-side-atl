import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Info, Phone, Play } from "lucide-react";
import { BUSINESS } from "@/lib/constants";

const STATS = [
  { label: "Service Hours", value: "24/7" },
  { label: "Help Starts At", value: "$75" },
  { label: "Metro Coverage", value: "ITP+OTP" },
];

export function Hero() {
  return (
    <section aria-label="Hero" className="border-b bg-[#faf9f6] text-neutral-950">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2">
          {/* Left — announcement, headline, CTAs, tagline */}
          <div className="flex min-h-[34rem] flex-col py-10 pr-0 lg:min-h-[40rem] lg:border-r lg:pr-12">
            <Link
              href="/services"
              className="group inline-flex w-fit items-center gap-2 text-sm font-medium"
            >
              <span className="rounded-md bg-amber-400 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider">
                NEW
              </span>
              Mobile mechanics now serving Atlanta
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                ▸
              </span>
            </Link>

            <h1 className="mt-16 max-w-xl text-5xl font-semibold leading-[1.04] tracking-tight md:text-6xl lg:mt-24 lg:text-7xl">
              Atlanta roadside help from the palm of your hand
            </h1>

            <div className="mt-12 flex flex-wrap items-center gap-6">
              <Link
                href="/book"
                className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-7 py-4 font-mono text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-neutral-800"
              >
                Book Now
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
              <a
                href={`tel:${BUSINESS.phone}`}
                aria-label={`Call us at ${BUSINESS.phone}`}
                className="group inline-flex items-center gap-2 font-mono text-sm font-medium uppercase tracking-wider"
              >
                Call Us
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-950 text-white transition-colors group-hover:bg-neutral-700">
                  <Phone aria-hidden className="h-3 w-3" />
                </span>
              </a>
            </div>

            <div className="mt-auto pt-16">
              <div className="border-t pt-6">
                <p className="max-w-sm text-lg leading-snug">
                  The modern roadside assistance platform,
                  <br className="hidden sm:block" /> built for the speed of Atlanta
                </p>
              </div>
              <a
                href="#services"
                aria-label="Scroll to services"
                className="mt-8 inline-flex h-8 w-12 items-center justify-center rounded-full bg-neutral-200/70 transition-colors hover:bg-neutral-300"
              >
                <ArrowDown aria-hidden className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Right — engraved illustration + stats band */}
          <div className="flex flex-col lg:pl-12">
            <div className="flex flex-1 items-center justify-center py-8 lg:py-16">
              <Image
                src="/images/hero-engraving.svg"
                alt="Line illustration of a tow truck on a tree-lined Atlanta street with the city skyline behind it"
                width={1024}
                height={768}
                priority
                className="h-auto w-full max-w-xl mix-blend-multiply"
              />
            </div>

            <div className="border-t py-8">
              <dl className="grid grid-cols-3 gap-4">
                {STATS.map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-sm text-neutral-500">{stat.label}</dt>
                    <dd className="mt-2 font-mono text-3xl font-semibold tracking-tight md:text-4xl">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <Link
                href="/services"
                className="mt-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
              >
                <Info aria-hidden className="h-3.5 w-3.5" />
                See pricing details
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

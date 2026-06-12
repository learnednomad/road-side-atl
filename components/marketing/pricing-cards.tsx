import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SectionHeading } from "./section-heading";

const ROADSIDE_POINTS = [
  "Jump start, lockout & fuel delivery — $75 flat",
  "Flat tire change — $100",
  "Pay after the job is done",
  "Cash, CashApp, Zelle, or card",
];

const TOWING_POINTS = [
  "First 10 miles included",
  "$6 per mile after that",
  "Flatbed & wheel-lift across ITP + OTP",
  "Upfront estimate before we roll",
];

// Titan-style fee section: one quiet card, one ink card. Numbers in mono.
export function PricingCards() {
  return (
    <section aria-labelledby="pricing-heading" className="border-b bg-[#faf9f6]">
      <div className="container mx-auto px-4 py-20">
        <SectionHeading
          kicker="Pricing"
          title="One clear price. No hidden fees."
          id="pricing-heading"
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white/40 p-8">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">
              Roadside rescue
            </p>
            <p className="mt-4 font-mono text-5xl font-semibold tracking-tight text-neutral-950">
              $75
              <span className="ml-2 align-middle font-sans text-sm font-normal text-neutral-500">
                starting
              </span>
            </p>
            <ul className="mt-8 flex-1 space-y-3">
              {ROADSIDE_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-neutral-700">
                  <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  {point}
                </li>
              ))}
            </ul>
            <Link
              href="/book"
              className="mt-8 inline-flex w-fit items-center gap-2 rounded-full border border-neutral-950 px-6 py-3 font-mono text-sm font-medium uppercase tracking-wider text-neutral-950 transition-colors hover:bg-neutral-950 hover:text-white"
            >
              Book roadside
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex flex-col rounded-2xl bg-neutral-950 p-8 text-white">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-400">
              Local towing
            </p>
            <p className="mt-4 font-mono text-5xl font-semibold tracking-tight">
              $125
              <span className="ml-2 align-middle font-sans text-sm font-normal text-neutral-400">
                + miles
              </span>
            </p>
            <ul className="mt-8 flex-1 space-y-3">
              {TOWING_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-neutral-300">
                  <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  {point}
                </li>
              ))}
            </ul>
            <Link
              href="/book?service=towing"
              className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-white px-6 py-3 font-mono text-sm font-medium uppercase tracking-wider text-neutral-950 transition-colors hover:bg-neutral-200"
            >
              Book a tow
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

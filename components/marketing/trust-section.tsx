import { Check } from "lucide-react";
import { SectionHeading } from "./section-heading";

const TRUST_POINTS = [
  {
    title: "Background-checked technicians",
    body: "Every provider passes a national background screening before their first dispatch.",
  },
  {
    title: "Trained and policy-certified",
    body: "Providers complete safety, service-standard, and payment training before going live.",
  },
  {
    title: "Live tracking and updates",
    body: "Watch your technician en route and get SMS updates from dispatch to done.",
  },
  {
    title: "Quotes before work starts",
    body: "For mechanic work, you approve an itemized quote up front — the price is locked before anyone turns a wrench.",
  },
];

export function TrustSection() {
  return (
    <section aria-labelledby="trust-heading" className="border-b bg-[#faf9f6]">
      <div className="container mx-auto px-4 py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading
              kicker="Trust"
              title="Help you can count on, from people you can verify"
              id="trust-heading"
            />
            <ul className="space-y-6">
              {TRUST_POINTS.map((point) => (
                <li key={point.title} className="flex items-start gap-4">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-950">
                    <Check aria-hidden className="h-3 w-3 text-white" />
                  </span>
                  <div>
                    <p className="font-medium text-neutral-950">{point.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-600">{point.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col justify-center rounded-2xl bg-neutral-950 p-10 text-white">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-400">
              Since day one
            </p>
            <p className="mt-6 font-mono text-6xl font-semibold tracking-tight">500+</p>
            <p className="mt-2 text-lg text-neutral-300">Atlanta drivers rescued</p>
            <div className="mt-10 border-t border-neutral-800 pt-8">
              <p className="text-lg leading-relaxed">
                Every job runs end-to-end on the platform — booked online, dispatched in
                minutes, tracked live, and closed with a digital receipt in your inbox.
              </p>
              <p className="mt-4 font-mono text-xs uppercase tracking-wider text-neutral-400">
                24/7 · Atlanta Metro · ITP + OTP
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

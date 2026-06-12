import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Titan-style scenario row: two quiet outline cards plus one loud card.
// Red is reserved for the "act now" card — the one urgent moment on the page.
const QUIET_SCENARIOS = [
  {
    kicker: "Won't start?",
    title: "Dead battery or flat tire",
    body: "Jump starts and fuel delivery from $75, tire changes from $100. A technician comes to you — ITP or OTP.",
    href: "/book",
    cta: "Book a fix",
  },
  {
    kicker: "Buying used?",
    title: "Inspect before you buy",
    body: "Pre-purchase diagnostics from $150 with OBD2 scan, photo documentation, and a repair-cost report.",
    href: "/book?service=basic-inspection",
    cta: "Book an inspection",
  },
];

export function ScenarioCards() {
  return (
    <section aria-label="Common scenarios" className="border-b bg-[#faf9f6]">
      <div className="container mx-auto px-4 py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {QUIET_SCENARIOS.map((s) => (
            <Link
              key={s.title}
              href={s.href}
              className="group flex flex-col rounded-2xl border border-neutral-200 bg-white/40 p-7 transition-colors hover:border-neutral-400"
            >
              <p className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">
                {s.kicker}
              </p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-neutral-950">
                {s.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600">{s.body}</p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-950">
                {s.cta}
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          ))}

          <Link
            href="/book"
            className="group flex flex-col rounded-2xl bg-red-600 p-7 text-white transition-colors hover:bg-red-700"
          >
            <p className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-red-200">
              Stranded right now?
            </p>
            <h3 className="mt-3 text-xl font-semibold tracking-tight">
              Get help in minutes
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-red-100">
              24/7 dispatch across metro Atlanta. Track your technician live from the moment they roll out.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 font-mono text-sm font-medium uppercase tracking-wider">
              Book now
              <ArrowRight
                aria-hidden
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

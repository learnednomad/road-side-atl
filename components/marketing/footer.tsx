import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BUSINESS } from "@/lib/constants";

const SERVICE_LINKS = [
  { href: "/services#roadside", label: "Towing in Atlanta" },
  { href: "/services#roadside", label: "Jump Start Service" },
  { href: "/services#roadside", label: "Car Lockout Help" },
  { href: "/services#roadside", label: "Flat Tire Change" },
  { href: "/services#roadside", label: "Fuel Delivery" },
  { href: "/services#diagnostics", label: "Car Diagnostics" },
];

const COMPANY_LINKS = [
  { href: "/services", label: "All Services" },
  { href: "/about", label: "About Us" },
  { href: "/book", label: "Book Now" },
  { href: "/become-provider", label: "Become a Provider" },
  { href: "/account/membership", label: "Membership" },
];

export function Footer() {
  return (
    <footer className="bg-neutral-950 text-neutral-400" role="contentinfo">
      {/* CTA row */}
      <div className="border-b border-neutral-800">
        <div className="container mx-auto flex flex-col gap-6 px-4 py-14 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Need help right now? We&apos;re on the road 24/7.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/book"
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-7 py-4 font-mono text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-red-500"
            >
              Book Now
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
            <a
              href={`tel:${BUSINESS.phone}`}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-700 px-7 py-4 font-mono text-sm font-medium uppercase tracking-wider text-white transition-colors hover:border-neutral-500"
            >
              {BUSINESS.phone}
            </a>
          </div>
        </div>
      </div>

      {/* Link columns */}
      <div className="container mx-auto px-4 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <p className="text-lg font-bold text-white">
              RoadSide <span className="text-red-500">GA</span>
            </p>
            <p className="mt-4 text-sm leading-relaxed">
              Atlanta&apos;s trusted 24/7 roadside assistance provider. Professional,
              reliable emergency towing, jump starts, lockout service, and more.
            </p>
          </div>
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">
              Services
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {SERVICE_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">
              Company
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {COMPANY_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">
              Contact
            </p>
            <address className="not-italic">
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <a href={`tel:${BUSINESS.phone}`} className="transition-colors hover:text-white">
                    {BUSINESS.phone}
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${BUSINESS.email}`}
                    className="transition-colors hover:text-white"
                  >
                    {BUSINESS.email}
                  </a>
                </li>
                <li>{BUSINESS.serviceArea}</li>
              </ul>
            </address>
          </div>
        </div>
      </div>

      {/* Legal strip */}
      <div className="border-t border-neutral-800">
        <div className="container mx-auto flex flex-col gap-2 px-4 py-8 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.
          </p>
          <p>
            24/7 Roadside Assistance serving Atlanta, Buckhead, Midtown, Decatur, Marietta,
            Sandy Springs, Roswell, Alpharetta &amp; all metro Atlanta.
          </p>
        </div>
      </div>
    </footer>
  );
}

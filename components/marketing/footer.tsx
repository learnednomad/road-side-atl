import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { BUSINESS } from "@/lib/constants";

export function Footer() {
  return (
    <>
      {/* Red CTA Band */}
      <section className="bg-red-600 py-8 text-white">
        <div className="container mx-auto flex flex-col items-center gap-4 px-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-xl font-bold">Need Help Now?</p>
            <p className="text-white/80">
              Our team is available 24/7 across Atlanta
            </p>
          </div>
          <a
            href={`tel:${BUSINESS.phone}`}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-lg font-bold text-red-600 transition-opacity hover:opacity-90"
          >
            <Phone className="h-5 w-5" />
            Call {BUSINESS.phone}
          </a>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-300" role="contentinfo">
        <div className="container mx-auto px-4 py-12">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <h3 className="mb-4 text-lg font-bold text-white">
                RoadSide <span className="text-red-400">ATL</span>
              </h3>
              <p className="text-sm">
                Atlanta&apos;s trusted 24/7 roadside assistance provider.
                Professional, reliable emergency towing, jump starts, lockout
                service, and more.
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-white">Our Services</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="/services#roadside"
                    className="hover:text-red-400"
                  >
                    Towing in Atlanta
                  </Link>
                </li>
                <li>
                  <Link
                    href="/services#roadside"
                    className="hover:text-red-400"
                  >
                    Jump Start Service
                  </Link>
                </li>
                <li>
                  <Link
                    href="/services#roadside"
                    className="hover:text-red-400"
                  >
                    Car Lockout Help
                  </Link>
                </li>
                <li>
                  <Link
                    href="/services#roadside"
                    className="hover:text-red-400"
                  >
                    Flat Tire Change
                  </Link>
                </li>
                <li>
                  <Link
                    href="/services#roadside"
                    className="hover:text-red-400"
                  >
                    Fuel Delivery
                  </Link>
                </li>
                <li>
                  <Link
                    href="/services#diagnostics"
                    className="hover:text-red-400"
                  >
                    Car Diagnostics
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-white">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/services" className="hover:text-red-400">
                    All Services
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="hover:text-red-400">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/book" className="hover:text-red-400">
                    Book Now
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-white">Contact</h4>
              <address className="not-italic">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    <a
                      href={`tel:${BUSINESS.phone}`}
                      className="hover:text-red-400"
                    >
                      {BUSINESS.phone}
                    </a>
                  </li>
                  <li className="flex items-center gap-2">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    <a
                      href={`mailto:${BUSINESS.email}`}
                      className="hover:text-red-400"
                    >
                      {BUSINESS.email}
                    </a>
                  </li>
                  <li className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    <span>{BUSINESS.serviceArea}</span>
                  </li>
                </ul>
              </address>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-700 pt-8">
            <div className="text-center text-sm">
              <p>
                &copy; {new Date().getFullYear()} {BUSINESS.name}. All rights
                reserved.
              </p>
              <p className="mt-2">
                24/7 Roadside Assistance serving Atlanta, Buckhead, Midtown,
                Decatur, Marietta, Sandy Springs, Roswell, Alpharetta & all
                metro Atlanta.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

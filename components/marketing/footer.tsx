import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { BUSINESS } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t bg-muted/50" role="contentinfo">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <h3 className="mb-4 text-lg font-bold">{BUSINESS.name}</h3>
            <p className="text-sm text-muted-foreground">
              Atlanta&apos;s trusted 24/7 roadside assistance provider. Professional,
              reliable emergency towing, jump starts, lockout service, and more.
            </p>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">Our Services</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/services#roadside" className="hover:text-foreground">Towing in Atlanta</Link></li>
              <li><Link href="/services#roadside" className="hover:text-foreground">Jump Start Service</Link></li>
              <li><Link href="/services#roadside" className="hover:text-foreground">Car Lockout Help</Link></li>
              <li><Link href="/services#roadside" className="hover:text-foreground">Flat Tire Change</Link></li>
              <li><Link href="/services#roadside" className="hover:text-foreground">Fuel Delivery</Link></li>
              <li><Link href="/services#diagnostics" className="hover:text-foreground">Car Diagnostics</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">Quick Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/services" className="hover:text-foreground">All Services</Link></li>
              <li><Link href="/about" className="hover:text-foreground">About Us</Link></li>
              <li><Link href="/book" className="hover:text-foreground">Book Now</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">Contact</h4>
            <address className="not-italic">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  <a href={`tel:${BUSINESS.phone}`} className="hover:text-foreground">
                    {BUSINESS.phone}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  <a href={`mailto:${BUSINESS.email}`} className="hover:text-foreground">
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
        <div className="mt-8 border-t pt-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.</p>
            <p className="mt-2">
              24/7 Roadside Assistance serving Atlanta, Buckhead, Midtown, Decatur,
              Marietta, Sandy Springs, Roswell, Alpharetta & all metro Atlanta.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

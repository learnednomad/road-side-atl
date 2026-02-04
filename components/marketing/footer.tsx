import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { BUSINESS } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t bg-muted/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="mb-4 text-lg font-bold">{BUSINESS.name}</h3>
            <p className="text-sm text-muted-foreground">
              {BUSINESS.tagline}. Professional, reliable service
              when you need it most.
            </p>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">Quick Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/services" className="hover:text-foreground">Services</Link></li>
              <li><Link href="/book" className="hover:text-foreground">Book Now</Link></li>
              <li><Link href="/login" className="hover:text-foreground">Sign In</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <a href={`tel:${BUSINESS.phone}`} className="hover:text-foreground">
                  {BUSINESS.phone}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>{BUSINESS.zelleInfo}</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{BUSINESS.serviceArea}</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

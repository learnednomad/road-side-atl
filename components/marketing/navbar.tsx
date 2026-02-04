"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { BUSINESS } from "@/lib/constants";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/book", label: "Book Now" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold">
          {BUSINESS.name}
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <a href={`tel:${BUSINESS.phone}`}>
            <Button variant="outline" size="sm">
              <Phone className="mr-2 h-4 w-4" />
              {BUSINESS.phone}
            </Button>
          </a>
          <Link href="/book">
            <Button size="sm">Get Help Now</Button>
          </Link>
        </div>

        {/* Mobile nav */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="mt-8 flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-lg font-medium"
                >
                  {link.label}
                </Link>
              ))}
              <a href={`tel:${BUSINESS.phone}`}>
                <Button variant="outline" className="w-full">
                  <Phone className="mr-2 h-4 w-4" />
                  {BUSINESS.phone}
                </Button>
              </a>
              <Link href="/book" onClick={() => setOpen(false)}>
                <Button className="w-full">Get Help Now</Button>
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}

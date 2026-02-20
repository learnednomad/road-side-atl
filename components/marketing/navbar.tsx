"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Menu, Phone, LogIn, LogOut, LayoutDashboard, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { BUSINESS } from "@/lib/constants";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/book", label: "Book Now" },
];

function getPortalLink(role?: string): { href: string; label: string } {
  switch (role) {
    case "admin":
      return { href: "/admin", label: "Admin Panel" };
    case "provider":
      return { href: "/provider", label: "Provider Portal" };
    default:
      return { href: "/", label: "Dashboard" };
  }
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";
  const portal = getPortalLink(session?.user?.role);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold">
          {BUSINESS.name}
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-foreground ${
                  isActive ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <Button asChild variant="outline" size="sm">
            <a href={`tel:${BUSINESS.phone}`}>
              <Phone className="mr-2 h-4 w-4" />
              {BUSINESS.phone}
            </a>
          </Button>
          {isLoggedIn ? (
            <>
              {session?.user?.role === "customer" && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/my-bookings">
                    <ClipboardList className="mr-2 h-4 w-4" />
                    My Bookings
                  </Link>
                </Button>
              )}
              {(session?.user?.role === "admin" || session?.user?.role === "provider") && (
                <Button asChild variant="outline" size="sm">
                  <Link href={portal.href}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    {portal.label}
                  </Link>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/book">Get Help Now</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile nav */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SheetDescription className="sr-only">Main navigation links and service booking options</SheetDescription>
            <div className="mt-8 flex flex-col gap-4">
              {navLinks.map((link) => {
                const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={`text-lg font-medium ${
                      isActive ? "text-primary" : ""
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <Button asChild variant="outline" className="w-full">
                <a href={`tel:${BUSINESS.phone}`}>
                  <Phone className="mr-2 h-4 w-4" />
                  {BUSINESS.phone}
                </a>
              </Button>
              {isLoggedIn ? (
                <>
                  {session?.user?.role === "customer" && (
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/my-bookings" onClick={() => setOpen(false)}>
                        <ClipboardList className="mr-2 h-4 w-4" />
                        My Bookings
                      </Link>
                    </Button>
                  )}
                  {(session?.user?.role === "admin" || session?.user?.role === "provider") && (
                    <Button asChild variant="outline" className="w-full">
                      <Link href={portal.href} onClick={() => setOpen(false)}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        {portal.label}
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setOpen(false);
                      signOut({ callbackUrl: "/" });
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/login" onClick={() => setOpen(false)}>
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign In
                    </Link>
                  </Button>
                  <Button asChild className="w-full">
                    <Link href="/book" onClick={() => setOpen(false)}>
                      Get Help Now
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}

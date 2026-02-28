"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Menu, Phone, LogIn, LogOut, LayoutDashboard, ClipboardList, Home, Wrench, Info, CalendarCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { BUSINESS } from "@/lib/constants";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/services", label: "Services", icon: Wrench },
  { href: "/about", label: "About", icon: Info },
  { href: "/book", label: "Book Now", icon: CalendarCheck },
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
    <>
      <div className="h-1 bg-red-600" />
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold">
          RoadSide <span className="text-red-600">ATL</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-red-600 ${
                  isActive ? "text-red-600" : "text-muted-foreground"
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
          <SheetContent side="right" className="flex w-80 flex-col gap-0 p-0">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SheetDescription className="sr-only">Main navigation links and service booking options</SheetDescription>

            {/* Brand header */}
            <div className="border-b px-6 py-5">
              <p className="text-lg font-bold">{BUSINESS.name}</p>
              <p className="text-xs text-muted-foreground">24/7 Roadside Assistance</p>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-3 py-4">
              <div className="space-y-1">
                {navLinks.map((link) => {
                  const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-red-600/10 text-red-600"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <link.icon className={`h-5 w-5 ${isActive ? "text-red-600" : "text-muted-foreground"}`} />
                      {link.label}
                      {isActive && <div className="ml-auto h-2 w-2 rounded-full bg-red-600" />}
                    </Link>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="my-4 border-t" />

              {/* Account section */}
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</p>
              <div className="space-y-1">
                {isLoggedIn ? (
                  <>
                    {session?.user?.role === "customer" && (
                      <Link
                        href="/my-bookings"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"
                      >
                        <ClipboardList className="h-5 w-5 text-muted-foreground" />
                        My Bookings
                      </Link>
                    )}
                    {(session?.user?.role === "admin" || session?.user?.role === "provider") && (
                      <Link
                        href={portal.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"
                      >
                        <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
                        {portal.label}
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setOpen(false);
                        signOut({ callbackUrl: "/" });
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      <LogOut className="h-5 w-5 text-muted-foreground" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    <LogIn className="h-5 w-5 text-muted-foreground" />
                    Sign In
                  </Link>
                )}
              </div>
            </nav>

            {/* Bottom CTA area */}
            <div className="mt-auto space-y-3 border-t bg-muted/30 px-4 py-5">
              <Button asChild className="w-full" size="lg">
                <Link href="/book" onClick={() => setOpen(false)}>
                  Get Help Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <a
                href={`tel:${BUSINESS.phone}`}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-600 bg-red-600/5 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-600/10"
              >
                <Phone className="h-4 w-4" />
                Call {BUSINESS.phone}
              </a>
            </div>
          </SheetContent>
        </Sheet>
        </nav>
      </header>
    </>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, Phone, LogIn, LogOut, LayoutDashboard, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { BUSINESS } from "@/lib/constants";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
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
          {isLoggedIn ? (
            <>
              {session?.user?.role === "customer" && (
                <Link href="/my-bookings">
                  <Button variant="outline" size="sm">
                    <ClipboardList className="mr-2 h-4 w-4" />
                    My Bookings
                  </Button>
                </Link>
              )}
              {(session?.user?.role === "admin" || session?.user?.role === "provider") && (
                <Link href={portal.href}>
                  <Button variant="outline" size="sm">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    {portal.label}
                  </Button>
                </Link>
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
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </Button>
              </Link>
              <Link href="/book">
                <Button size="sm">Get Help Now</Button>
              </Link>
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
              {isLoggedIn ? (
                <>
                  {session?.user?.role === "customer" && (
                    <Link href="/my-bookings" onClick={() => setOpen(false)}>
                      <Button variant="outline" className="w-full">
                        <ClipboardList className="mr-2 h-4 w-4" />
                        My Bookings
                      </Button>
                    </Link>
                  )}
                  {(session?.user?.role === "admin" || session?.user?.role === "provider") && (
                    <Link href={portal.href} onClick={() => setOpen(false)}>
                      <Button variant="outline" className="w-full">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        {portal.label}
                      </Button>
                    </Link>
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
                  <Link href="/login" onClick={() => setOpen(false)}>
                    <Button variant="outline" className="w-full">
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/book" onClick={() => setOpen(false)}>
                    <Button className="w-full">Get Help Now</Button>
                  </Link>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}

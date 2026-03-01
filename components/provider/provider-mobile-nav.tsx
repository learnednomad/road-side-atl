"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, FileText, Settings, LogOut, Home, Menu, DollarSign, Eye, Search, Users } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";

const links = [
  { href: "/provider", label: "Dashboard", icon: LayoutDashboard },
  { href: "/provider/jobs", label: "Jobs", icon: ClipboardList },
  { href: "/provider/earnings", label: "Earnings", icon: DollarSign },
  { href: "/provider/invoices", label: "Invoices", icon: FileText },
  { href: "/provider/observations", label: "Observations", icon: Eye },
  { href: "/provider/inspections", label: "Inspections", icon: Search },
  { href: "/provider/referrals", label: "Referrals", icon: Users },
  { href: "/provider/settings", label: "Settings", icon: Settings },
];

export function ProviderMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="flex h-16 items-center justify-between border-b px-4 lg:hidden">
      <Link href="/provider" className="text-lg font-bold">
        Provider Portal
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-72">
          <SheetTitle className="sr-only">Provider Navigation</SheetTitle>
          <SheetDescription className="sr-only">Navigate provider portal pages</SheetDescription>
          <nav className="mt-8 flex flex-1 flex-col justify-between">
            <div className="space-y-1">
              {links.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/provider" && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-8 space-y-1 border-t pt-4">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Home className="h-4 w-4" />
                Back to Site
              </Link>
              <button
                onClick={() => {
                  setOpen(false);
                  signOut({ callbackUrl: "/" });
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}

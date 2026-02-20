"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, Settings, LogOut, Home, DollarSign, FileText, Eye, Search, Users } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

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

export function ProviderSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-col border-r bg-muted/30 lg:flex">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/provider" className="text-lg font-bold">
          Provider Portal
        </Link>
      </div>
      <nav className="flex flex-1 flex-col justify-between p-4">
        <div className="space-y-1">
          {links.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/provider" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
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
        <div className="space-y-1 border-t pt-4">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Home className="h-4 w-4" />
            Back to Site
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </nav>
    </aside>
  );
}

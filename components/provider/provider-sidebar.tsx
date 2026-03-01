"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Settings,
  LogOut,
  Home,
  DollarSign,
  Eye,
  Search,
  Users,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
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
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("provider-sidebar-collapsed") === "true";
  });

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem("provider-sidebar-collapsed", String(!prev));
      return !prev;
    });
  };

  return (
    <aside
      className={cn(
        "hidden flex-col border-r bg-muted/30 transition-all duration-300 lg:flex",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-16 items-center justify-between border-b px-3">
        {!collapsed && (
          <Link href="/provider" className="truncate text-lg font-bold">
            Provider Portal
          </Link>
        )}
        <button
          onClick={toggle}
          className={cn(
            "flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
            collapsed && "mx-auto"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <ChevronsLeft className="h-4 w-4" />
          )}
        </button>
      </div>
      <nav className="flex flex-1 flex-col justify-between p-2">
        <div className="space-y-1">
          {links.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/provider" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                title={collapsed ? link.label : undefined}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  collapsed ? "justify-center" : "gap-3",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <link.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{link.label}</span>}
              </Link>
            );
          })}
        </div>
        <div className="space-y-1 border-t pt-4">
          <Link
            href="/"
            title={collapsed ? "Back to Site" : undefined}
            className={cn(
              "flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
              collapsed ? "justify-center" : "gap-3"
            )}
          >
            <Home className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">Back to Site</span>}
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            title={collapsed ? "Sign Out" : undefined}
            className={cn(
              "flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
              collapsed ? "justify-center" : "gap-3"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">Sign Out</span>}
          </button>
        </div>
      </nav>
    </aside>
  );
}

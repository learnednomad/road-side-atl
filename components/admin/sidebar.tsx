"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  DollarSign,
  Users,
  Wrench,
  Banknote,
  FileText,
  Settings,
  LogOut,
  Home,
  ScrollText,
  PiggyBank,
  Shield,
  TrendingUp,
  Percent,
  BarChart3,
  Building2,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/revenue", label: "Revenue", icon: DollarSign },
  { href: "/admin/finances", label: "Finances", icon: PiggyBank },
  { href: "/admin/invoices", label: "Invoices", icon: FileText },
  { href: "/admin/providers", label: "Providers", icon: Wrench },
  { href: "/admin/payouts", label: "Payouts", icon: Banknote },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/trust-tier", label: "Trust Tier", icon: Shield },
  { href: "/admin/pricing", label: "Pricing", icon: TrendingUp },
  { href: "/admin/commission", label: "Commission", icon: Percent },
  { href: "/admin/financial-reports", label: "Financial Reports", icon: BarChart3 },
  { href: "/admin/b2b-accounts", label: "B2B Accounts", icon: Building2 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("admin-sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem("admin-sidebar-collapsed", String(!prev));
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
          <Link href="/admin" className="truncate text-lg font-bold">
            Admin
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
              (link.href !== "/admin" && pathname.startsWith(link.href));
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

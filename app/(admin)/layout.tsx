import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s | Admin | RoadSide GA",
  },
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 bg-[#faf9f6]">
        <AdminMobileNav />
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}

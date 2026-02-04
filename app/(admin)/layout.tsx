import { AdminSidebar } from "@/components/admin/sidebar";
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1">
        {/* Mobile header */}
        <header className="flex h-16 items-center border-b px-6 lg:hidden">
          <Link href="/admin" className="text-lg font-bold">
            Admin
          </Link>
        </header>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

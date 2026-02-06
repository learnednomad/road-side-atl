import { ProviderSidebar } from "@/components/provider/provider-sidebar";
import Link from "next/link";

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <ProviderSidebar />
      <div className="flex-1">
        <header className="flex h-16 items-center border-b px-6 lg:hidden">
          <Link href="/provider" className="text-lg font-bold">
            Provider Portal
          </Link>
        </header>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

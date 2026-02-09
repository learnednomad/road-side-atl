import { ProviderSidebar } from "@/components/provider/provider-sidebar";
import { ProviderMobileNav } from "@/components/provider/provider-mobile-nav";

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <ProviderSidebar />
      <div className="flex-1">
        <ProviderMobileNav />
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

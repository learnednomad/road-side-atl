import type { Metadata } from "next";
import { ProviderSidebar } from "@/components/provider/provider-sidebar";
import { ProviderMobileNav } from "@/components/provider/provider-mobile-nav";
import { OfflineBanner } from "@/components/provider/offline-banner";
import { AgreementRequiredBanner } from "@/components/provider/agreement-required-banner";

export const metadata: Metadata = {
  title: {
    default: "Provider Portal",
    template: "%s | Provider | RoadSide GA",
  },
  robots: { index: false, follow: false },
};

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <ProviderSidebar />
      <div className="flex-1">
        <AgreementRequiredBanner />
        <OfflineBanner />
        <ProviderMobileNav />
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

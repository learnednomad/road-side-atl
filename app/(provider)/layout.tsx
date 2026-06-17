import type { Metadata } from "next";
import { ProviderSidebar } from "@/components/provider/provider-sidebar";
import { ProviderMobileNav } from "@/components/provider/provider-mobile-nav";
import { OfflineBanner } from "@/components/provider/offline-banner";
import { AgreementRequiredBanner } from "@/components/provider/agreement-required-banner";
import { InboxBell } from "@/components/notifications/inbox-bell";

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
      <div className="flex-1 bg-[#faf9f6]">
        <AgreementRequiredBanner />
        <OfflineBanner />
        <ProviderMobileNav />
        <div className="flex justify-end px-6 pt-4 lg:px-8">
          <InboxBell />
        </div>
        <div className="p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}

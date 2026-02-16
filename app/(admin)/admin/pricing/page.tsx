import { Metadata } from "next";
import { StormModeToggle } from "@/components/admin/storm-mode-toggle";
import { PricingConfigTable } from "@/components/admin/pricing-config-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing | Admin | RoadSide ATL",
};

export default function AdminPricingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Pricing</h1>
      <StormModeToggle />
      <PricingConfigTable />
    </div>
  );
}

import type { Metadata } from "next";
import { ProviderDashboard } from "@/components/provider/provider-dashboard";

// Server wrapper so the provider index gets a real, provider-scoped <title>
// (the group layout template appends "| Provider | RoadSide GA").
export const metadata: Metadata = { title: "Dashboard" };

export default function ProviderDashboardPage() {
  return <ProviderDashboard />;
}

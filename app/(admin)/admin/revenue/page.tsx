import { Metadata } from "next";
import { RevenueAnalytics } from "@/components/admin/revenue-analytics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Revenue | Admin | RoadSide ATL",
};

export default function AdminRevenuePage() {
  return <RevenueAnalytics />;
}

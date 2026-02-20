import { Metadata } from "next";
import { FinancesDashboard } from "@/components/admin/finances-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Finances | Admin | RoadSide ATL",
};

export default function AdminFinancesPage() {
  return <FinancesDashboard />;
}

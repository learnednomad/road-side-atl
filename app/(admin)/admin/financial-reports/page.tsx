import { Metadata } from "next";
import { FinancialReportsDashboard } from "@/components/admin/financial-reports-dashboard-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Financial Reports | Admin | RoadSide ATL",
};

export default function AdminFinancialReportsPage() {
  return <FinancialReportsDashboard />;
}

import { Metadata } from "next";
import { CommissionConfigTable } from "@/components/admin/commission-config-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Commission | Admin | RoadSide ATL",
};

export default function AdminCommissionPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Commission Rates</h1>
      <p className="text-muted-foreground">
        Configure platform commission rates per service category. The commission rate is the percentage the platform takes from each booking. Providers receive the remainder.
      </p>
      <CommissionConfigTable />
    </div>
  );
}

import { Metadata } from "next";
import { B2bAccountsTable } from "@/components/admin/b2b-accounts-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "B2B Accounts | Admin | RoadSide ATL",
};

export default function AdminB2bAccountsPage() {
  return <B2bAccountsTable />;
}

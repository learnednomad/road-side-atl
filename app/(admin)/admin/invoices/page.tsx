import { Metadata } from "next";
import { InvoicesTable } from "@/components/admin/invoices-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invoices | Admin | RoadSide ATL",
};

export default function AdminInvoicesPage() {
  return <InvoicesTable />;
}

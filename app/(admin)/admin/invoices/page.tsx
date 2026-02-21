import { Metadata } from "next";
import { InvoiceList } from "@/components/invoices/invoice-list";

export const metadata: Metadata = {
  title: "Invoices | Admin | RoadSide ATL",
};

export default function AdminInvoicesPage() {
  return <InvoiceList role="admin" />;
}

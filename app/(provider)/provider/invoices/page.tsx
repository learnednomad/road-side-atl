import { Metadata } from "next";
import { InvoiceList } from "@/components/invoices/invoice-list";

export const metadata: Metadata = {
  title: "Invoices | Provider | RoadSide ATL",
};

export default function ProviderInvoicesPage() {
  return <InvoiceList role="provider" />;
}

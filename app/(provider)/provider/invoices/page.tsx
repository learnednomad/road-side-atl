import { Metadata } from "next";
import { InvoiceList } from "@/components/invoices/invoice-list";

export const metadata: Metadata = {
  // Bare title — provider layouts append "| Provider | RoadSide GA" once.
  title: "Invoices",
};

export default function ProviderInvoicesPage() {
  return <InvoiceList role="provider" />;
}

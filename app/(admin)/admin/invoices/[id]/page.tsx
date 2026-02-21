"use client";

import { useParams } from "next/navigation";
import { InvoiceDetail } from "@/components/invoices/invoice-detail";

export default function AdminInvoiceDetailPage() {
  const params = useParams();
  return <InvoiceDetail invoiceId={params.id as string} role="admin" />;
}

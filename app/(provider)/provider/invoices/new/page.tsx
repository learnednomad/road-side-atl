"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { Loader2 } from "lucide-react";

function NewInvoiceContent() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">
        {editId ? "Edit Invoice" : "New Invoice"}
      </h1>
      <InvoiceForm role="provider" invoiceId={editId || undefined} />
    </div>
  );
}

export default function ProviderNewInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <NewInvoiceContent />
    </Suspense>
  );
}

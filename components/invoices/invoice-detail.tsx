"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Send,
  Pencil,
  Trash2,
  DollarSign,
  Loader2,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface LineItem {
  id: string;
  description: string;
  details: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerCompany: string | null;
  customerAddress: string | null;
  issueDate: string;
  dueDate: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentTerms: string | null;
  paymentMethod: string | null;
  paymentInstructions: string | null;
  notes: string | null;
  lineItems: LineItem[];
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

interface InvoiceDetailProps {
  invoiceId: string;
  role: "provider" | "admin";
}

export function InvoiceDetail({ invoiceId, role }: InvoiceDetailProps) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);

  const basePath = role === "admin" ? "/admin" : "/provider";

  useEffect(() => {
    fetch(`/api/invoices/${invoiceId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          toast.error(data.error);
        } else {
          setInvoice(data);
        }
      })
      .catch(() => toast.error("Failed to load invoice"))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  const handleAction = async (action: "send" | "paid" | "delete") => {
    if (!invoice) return;
    try {
      let res: Response;
      if (action === "send") {
        res = await fetch(`/api/invoices/${invoice.id}/send`, {
          method: "POST",
        });
      } else if (action === "paid") {
        res = await fetch(`/api/invoices/${invoice.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "paid" }),
        });
      } else {
        res = await fetch(`/api/invoices/${invoice.id}`, {
          method: "DELETE",
        });
      }

      if (res.ok) {
        if (action === "delete") {
          toast.success("Invoice deleted");
          router.push(`${basePath}/invoices`);
        } else {
          toast.success(
            action === "send"
              ? "Invoice marked as sent"
              : "Invoice marked as paid"
          );
          // Refresh
          const updated = await res.json();
          setInvoice((prev) => (prev ? { ...prev, ...updated } : prev));
        }
      } else {
        const err = await res.json();
        toast.error(err.error || "Action failed");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${invoice.invoiceNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        toast.error("Failed to download PDF");
      }
    } catch {
      toast.error("Network error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Invoice not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
            <span
              className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[invoice.status]}`}
            >
              {invoice.status}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
          {invoice.status === "draft" && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`${basePath}/invoices/new?edit=${invoice.id}`}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Link>
              </Button>
              <Button size="sm" onClick={() => handleAction("send")}>
                <Send className="mr-2 h-4 w-4" /> Send
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleAction("delete")}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </>
          )}
          {(invoice.status === "sent" || invoice.status === "overdue") && (
            <Button size="sm" onClick={() => handleAction("paid")}>
              <DollarSign className="mr-2 h-4 w-4" /> Mark as Paid
            </Button>
          )}
        </div>
      </div>

      {/* Invoice Info */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bill To
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-lg font-semibold">{invoice.customerName}</p>
            {invoice.customerCompany && <p>{invoice.customerCompany}</p>}
            {invoice.customerAddress && (
              <p className="text-sm text-muted-foreground">
                {invoice.customerAddress}
              </p>
            )}
            {invoice.customerEmail && (
              <p className="text-sm text-muted-foreground">
                {invoice.customerEmail}
              </p>
            )}
            {invoice.customerPhone && (
              <p className="text-sm text-muted-foreground">
                {invoice.customerPhone}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Invoice Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Issue Date</span>
              <span>
                {new Date(invoice.issueDate).toLocaleDateString()}
              </span>
            </div>
            {invoice.dueDate && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Due Date</span>
                <span>
                  {new Date(invoice.dueDate).toLocaleDateString()}
                </span>
              </div>
            )}
            {invoice.paymentTerms && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Terms</span>
                <span>{invoice.paymentTerms}</span>
              </div>
            )}
            {invoice.paymentMethod && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Method</span>
                <span>{invoice.paymentMethod}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lineItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.description}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.details || "\u2014"}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(item.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(item.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col items-end gap-1">
            <div className="flex w-56 justify-between text-sm">
              <span>Subtotal:</span>
              <span className="font-medium">
                {formatPrice(invoice.subtotal)}
              </span>
            </div>
            {invoice.taxRate > 0 && (
              <div className="flex w-56 justify-between text-sm">
                <span>Tax ({(invoice.taxRate / 100).toFixed(2)}%):</span>
                <span className="font-medium">
                  {formatPrice(invoice.taxAmount)}
                </span>
              </div>
            )}
            <Separator className="my-1 w-56" />
            <div className="flex w-56 justify-between text-lg font-bold">
              <span>Total:</span>
              <span>{formatPrice(invoice.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes & Payment Instructions */}
      {(invoice.notes || invoice.paymentInstructions) && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            {invoice.paymentInstructions && (
              <div>
                <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                  Payment Instructions
                </h3>
                <p className="text-sm">{invoice.paymentInstructions}</p>
              </div>
            )}
            {invoice.notes && (
              <div>
                <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                  Notes
                </h3>
                <p className="text-sm">{invoice.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

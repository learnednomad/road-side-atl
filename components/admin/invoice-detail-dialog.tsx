"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, Ban } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface Invoice {
  id: string;
  invoiceNumber: string;
  bookingId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  total: number;
  status: string;
  providerName: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface InvoiceDetailDialogProps {
  invoice: Invoice;
  open: boolean;
  onClose: () => void;
  onVoid: () => void;
}

export function InvoiceDetailDialog({
  invoice,
  open,
  onClose,
  onVoid,
}: InvoiceDetailDialogProps) {
  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "paid": return "default" as const;
      case "issued": return "secondary" as const;
      case "void": return "destructive" as const;
      default: return "outline" as const;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {invoice.invoiceNumber}
            <Badge variant={statusBadgeVariant(invoice.status)}>
              {invoice.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>Invoice details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Customer</div>
              <div className="font-medium">{invoice.customerName}</div>
              <div className="text-muted-foreground">{invoice.customerEmail}</div>
              <div className="text-muted-foreground">{invoice.customerPhone}</div>
            </div>
            <div className="text-right">
              {invoice.providerName && (
                <>
                  <div className="text-muted-foreground">Provider</div>
                  <div className="font-medium">{invoice.providerName}</div>
                </>
              )}
              <div className="text-muted-foreground mt-2">Type</div>
              <div className="font-medium">{invoice.bookingId ? "Platform" : "Standalone"}</div>
              <div className="text-muted-foreground mt-2">Created</div>
              <div>{new Date(invoice.createdAt).toLocaleDateString()}</div>
              {invoice.issuedAt && (
                <>
                  <div className="text-muted-foreground mt-1">Issued</div>
                  <div>{new Date(invoice.issuedAt).toLocaleDateString()}</div>
                </>
              )}
              {invoice.paidAt && (
                <>
                  <div className="text-muted-foreground mt-1">Paid</div>
                  <div>{new Date(invoice.paidAt).toLocaleDateString()}</div>
                </>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Description</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Price</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">{formatPrice(item.unitPrice)}</td>
                    <td className="px-3 py-2 text-right">{formatPrice(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-48 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>Total</span>
                <span>{formatPrice(invoice.total)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <span className="font-medium">Notes: </span>
              {invoice.notes}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/api/admin/invoices/${invoice.id}/html`, "_blank")}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            {invoice.status !== "void" && (
              <Button variant="destructive" size="sm" onClick={onVoid}>
                <Ban className="h-4 w-4 mr-2" />
                Void
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

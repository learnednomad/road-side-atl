"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Plus,
  Eye,
  Send,
  Ban,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";
import { CreateInvoiceDialog } from "@/components/provider/create-invoice-dialog";
import { ProviderInvoiceDetailDialog } from "@/components/provider/invoice-detail-dialog";

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

export default function ProviderInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");

      const res = await fetch(`/api/provider/invoices?${params}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.data || []);
        setTotalPages(data.totalPages || 1);
      } else {
        setFetchError(true);
      }
    } catch {
      setFetchError(true);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    fetchInvoices(); // eslint-disable-line react-hooks/set-state-in-effect -- data fetching pattern
  }, [fetchInvoices]);

  async function quickStatusUpdate(id: string, status: "issued" | "void") {
    if (status === "void" && !confirm("Are you sure you want to void this invoice?")) return;

    const res = await fetch(`/api/provider/invoices/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      toast.success(status === "issued" ? "Invoice issued" : "Invoice voided");
      fetchInvoices();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to update invoice");
    }
  }

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "paid": return "default" as const;
      case "issued": return "secondary" as const;
      case "void": return "destructive" as const;
      default: return "outline" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Invoices</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Invoice
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : fetchError ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                    <p className="text-sm text-muted-foreground">Failed to load invoices.</p>
                    <Button variant="outline" size="sm" onClick={fetchInvoices}>
                      <RefreshCw className="mr-2 h-3 w-3" />
                      Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No invoices found. Create your first standalone invoice!
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => {
                const isStandalone = !inv.bookingId;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-sm">{inv.customerName}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(inv.total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(inv.status)}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isStandalone ? "outline" : "secondary"}>
                        {isStandalone ? "Standalone" : "Platform"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedInvoice(inv)}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isStandalone && inv.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => quickStatusUpdate(inv.id, "issued")}
                            title="Issue invoice"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {isStandalone && (inv.status === "draft" || inv.status === "issued") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => quickStatusUpdate(inv.id, "void")}
                            title="Void invoice"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Invoice Dialog */}
      <CreateInvoiceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          fetchInvoices();
        }}
      />

      {/* Detail Dialog */}
      {selectedInvoice && (
        <ProviderInvoiceDetailDialog
          invoice={selectedInvoice}
          open={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onUpdated={() => {
            setSelectedInvoice(null);
            fetchInvoices();
          }}
        />
      )}
    </div>
  );
}

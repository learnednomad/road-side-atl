"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Download,
  Pencil,
  Send,
  Trash2,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: "draft" | "sent" | "issued" | "paid" | "overdue" | "cancelled" | "void";
  customerName: string;
  customerEmail: string | null;
  total: number;
  issueDate: string;
  issuedAt: string | null;
  dueDate: string | null;
  createdAt: string;
}

const statusVariants: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
  draft: "secondary",
  sent: "default",
  issued: "default",
  paid: "default",
  overdue: "destructive",
  cancelled: "outline",
  void: "outline",
};

const statusColors: Record<string, string> = {
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  issued: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

interface InvoiceListProps {
  role: "provider" | "admin";
}

export function InvoiceList({ role }: InvoiceListProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const basePath = role === "admin" ? "/admin" : "/provider";
  const apiPath = role === "admin" ? "/api/admin/invoices" : "/api/provider/invoices";

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);

      const res = await fetch(`${apiPath}?${params}`);
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
  }, [page, statusFilter, search, apiPath]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleAction = async (
    id: string,
    action: "send" | "paid" | "delete"
  ) => {
    try {
      let res: Response;
      if (action === "send") {
        res = await fetch(`${apiPath}/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "issued" }),
        });
      } else if (action === "paid") {
        res = await fetch(`${apiPath}/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "paid" }),
        });
      } else {
        res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      }

      if (res.ok) {
        toast.success(
          action === "send"
            ? "Invoice marked as sent"
            : action === "paid"
              ? "Invoice marked as paid"
              : "Invoice deleted"
        );
        fetchInvoices();
      } else {
        const err = await res.json();
        toast.error(err.error || "Action failed");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleDownloadPdf = async (id: string, invoiceNumber: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${invoiceNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        toast.error("Failed to download PDF");
      }
    } catch {
      toast.error("Network error");
    }
  };

  function renderStatusBadge(status: Invoice["status"]) {
    const customColor = statusColors[status];
    if (customColor) {
      return (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${customColor}`}
        >
          {status}
        </span>
      );
    }
    return <Badge variant={statusVariants[status] || "secondary"}>{status}</Badge>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Invoices</h1>
        <Button asChild>
          <Link href={`${basePath}/invoices/new`}>
            <Plus className="mr-2 h-4 w-4" /> New Invoice
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search invoices..."
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Failed to load invoices.
            </p>
            <Button variant="outline" size="sm" onClick={fetchInvoices}>
              <RefreshCw className="mr-2 h-3 w-3" /> Retry
            </Button>
          </div>
        ) : invoices.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No invoices found.
          </p>
        ) : (
          invoices.map((inv) => (
            <Card key={inv.id}>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <Link
                      href={`${basePath}/invoices/${inv.id}`}
                      className="font-medium hover:underline"
                    >
                      {inv.invoiceNumber}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {inv.customerName}
                    </p>
                  </div>
                  <p className="font-medium">{formatPrice(inv.total)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {renderStatusBadge(inv.status)}
                  <span className="text-xs text-muted-foreground">
                    {new Date(inv.issueDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`${basePath}/invoices/${inv.id}`}>
                      <Eye className="mr-1 h-3 w-3" /> View
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleDownloadPdf(inv.id, inv.invoiceNumber)
                    }
                  >
                    <Download className="mr-1 h-3 w-3" /> PDF
                  </Button>
                  {inv.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => handleAction(inv.id, "send")}
                    >
                      <Send className="mr-1 h-3 w-3" /> Send
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="w-10"></TableHead>
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
                    <p className="text-sm text-muted-foreground">
                      Failed to load invoices.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchInvoices}
                    >
                      <RefreshCw className="mr-2 h-3 w-3" /> Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  No invoices found.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link
                      href={`${basePath}/invoices/${inv.id}`}
                      className="font-medium hover:underline"
                    >
                      {inv.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{inv.customerName}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPrice(inv.total)}
                  </TableCell>
                  <TableCell>{renderStatusBadge(inv.status)}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(inv.issueDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {inv.dueDate
                      ? new Date(inv.dueDate).toLocaleDateString()
                      : "\u2014"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`${basePath}/invoices/${inv.id}`}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleDownloadPdf(inv.id, inv.invoiceNumber)
                          }
                        >
                          <Download className="mr-2 h-4 w-4" /> Download PDF
                        </DropdownMenuItem>
                        {inv.status === "draft" && (
                          <>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`${basePath}/invoices/new?edit=${inv.id}`}
                              >
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAction(inv.id, "send")}
                            >
                              <Send className="mr-2 h-4 w-4" /> Mark as Sent
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleAction(inv.id, "delete")}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                        {(inv.status === "sent" ||
                          inv.status === "overdue") && (
                          <DropdownMenuItem
                            onClick={() => handleAction(inv.id, "paid")}
                          >
                            <DollarSign className="mr-2 h-4 w-4" /> Mark as
                            Paid
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
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
    </div>
  );
}

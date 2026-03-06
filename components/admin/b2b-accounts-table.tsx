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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Eye,
  Pencil,
  FileText,
  BookOpen,
  Receipt,
  Send,
  CheckCircle,
  Clock,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface BillingAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface B2bContract {
  retainerAmountCents: number;
  perJobRateCents: number | null;
  includedServiceIds: string[];
  startDate: string;
  endDate: string;
}

interface B2bAccount {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  billingAddress: BillingAddress;
  paymentTerms: string;
  status: "pending" | "active" | "suspended";
  contract: B2bContract | null;
  notes: string | null;
  bookingCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface B2bInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  dueDate: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

type DialogMode = "create" | "edit" | "detail" | "contract" | "booking" | "invoices" | null;

export function B2bAccountsTable() {
  const [accounts, setAccounts] = useState<B2bAccount[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedAccount, setSelectedAccount] = useState<B2bAccount | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    paymentTerms: "net_30",
    notes: "",
  });

  // Contract form state
  const [contractData, setContractData] = useState({
    retainerAmountCents: 0,
    perJobRateCents: "",
    includedServiceIds: "",
    startDate: "",
    endDate: "",
  });

  // Booking form state
  const [bookingData, setBookingData] = useState({
    serviceId: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    address: "",
    year: "",
    make: "",
    model: "",
    color: "",
    notes: "",
  });

  const [services, setServices] = useState<Array<{ id: string; name: string }>>([]);

  // Invoice state
  const [accountInvoices, setAccountInvoices] = useState<B2bInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicePeriod, setInvoicePeriod] = useState({ start: "", end: "" });

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/admin/b2b-accounts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setAccounts(json.data);
      setTotalPages(json.totalPages);
      setTotal(json.total);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const fetchServices = async () => {
    try {
      const res = await fetch("/api/services");
      if (res.ok) {
        const data = await res.json();
        setServices(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
  };

  const openCreate = () => {
    setFormData({
      companyName: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      street: "",
      city: "",
      state: "",
      zip: "",
      paymentTerms: "net_30",
      notes: "",
    });
    setDialogMode("create");
  };

  const openDetail = async (account: B2bAccount) => {
    try {
      const res = await fetch(`/api/admin/b2b-accounts/${account.id}`);
      if (res.ok) {
        const detail = await res.json();
        setSelectedAccount(detail);
      } else {
        setSelectedAccount(account);
      }
    } catch {
      setSelectedAccount(account);
    }
    setDialogMode("detail");
  };

  const openEdit = (account: B2bAccount) => {
    setSelectedAccount(account);
    setFormData({
      companyName: account.companyName,
      contactName: account.contactName,
      contactEmail: account.contactEmail,
      contactPhone: account.contactPhone,
      street: account.billingAddress.street,
      city: account.billingAddress.city,
      state: account.billingAddress.state,
      zip: account.billingAddress.zip,
      paymentTerms: account.paymentTerms,
      notes: account.notes || "",
    });
    setDialogMode("edit");
  };

  const openContract = (account: B2bAccount) => {
    setSelectedAccount(account);
    setContractData({
      retainerAmountCents: account.contract?.retainerAmountCents || 0,
      perJobRateCents: account.contract?.perJobRateCents?.toString() || "",
      includedServiceIds: account.contract?.includedServiceIds?.join(", ") || "",
      startDate: account.contract?.startDate || "",
      endDate: account.contract?.endDate || "",
    });
    setDialogMode("contract");
  };

  const openBooking = (account: B2bAccount) => {
    setSelectedAccount(account);
    setBookingData({
      serviceId: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      address: "",
      year: "",
      make: "",
      model: "",
      color: "",
      notes: "",
    });
    fetchServices();
    setDialogMode("booking");
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/b2b-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: formData.companyName,
          contactName: formData.contactName,
          contactEmail: formData.contactEmail,
          contactPhone: formData.contactPhone,
          billingAddress: {
            street: formData.street,
            city: formData.city,
            state: formData.state,
            zip: formData.zip,
          },
          paymentTerms: formData.paymentTerms,
          notes: formData.notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create");
      }
      toast.success("B2B account created");
      setDialogMode(null);
      fetchAccounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create account");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedAccount) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/b2b-accounts/${selectedAccount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: formData.companyName,
          contactName: formData.contactName,
          contactEmail: formData.contactEmail,
          contactPhone: formData.contactPhone,
          billingAddress: {
            street: formData.street,
            city: formData.city,
            state: formData.state,
            zip: formData.zip,
          },
          paymentTerms: formData.paymentTerms,
          notes: formData.notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }
      toast.success("Account updated");
      setDialogMode(null);
      fetchAccounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update account");
    } finally {
      setSaving(false);
    }
  };

  const handleContractUpdate = async () => {
    if (!selectedAccount) return;
    setSaving(true);
    try {
      const serviceIds = contractData.includedServiceIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch(`/api/admin/b2b-accounts/${selectedAccount.id}/contract`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retainerAmountCents: contractData.retainerAmountCents,
          perJobRateCents: contractData.perJobRateCents ? parseInt(contractData.perJobRateCents) : null,
          includedServiceIds: serviceIds,
          startDate: contractData.startDate,
          endDate: contractData.endDate,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update contract");
      }
      toast.success("Contract updated");
      setDialogMode(null);
      fetchAccounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update contract");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (account: B2bAccount, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/b2b-accounts/${account.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update status");
      }
      toast.success(`Account ${newStatus}`);
      fetchAccounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    }
  };

  const handleCreateBooking = async () => {
    if (!selectedAccount) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/b2b-accounts/${selectedAccount.id}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: bookingData.serviceId,
          contactName: bookingData.contactName,
          contactPhone: bookingData.contactPhone,
          contactEmail: bookingData.contactEmail,
          vehicleInfo: {
            year: bookingData.year,
            make: bookingData.make,
            model: bookingData.model,
            color: bookingData.color,
          },
          location: {
            address: bookingData.address,
          },
          notes: bookingData.notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create booking");
      }
      toast.success("B2B booking created");
      setDialogMode(null);
      fetchAccounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create booking");
    } finally {
      setSaving(false);
    }
  };

  const [invoiceActionLoading, setInvoiceActionLoading] = useState<string | null>(null);

  const fetchAccountInvoices = async (accountId: string) => {
    setInvoicesLoading(true);
    try {
      const res = await fetch(`/api/admin/b2b-accounts/${accountId}/invoices`);
      if (!res.ok) throw new Error("Failed to fetch invoices");
      const data = await res.json();
      setAccountInvoices(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setInvoicesLoading(false);
    }
  };

  const openInvoices = (account: B2bAccount) => {
    setSelectedAccount(account);
    setAccountInvoices([]);
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setInvoicePeriod({
      start: firstOfMonth.toISOString().split("T")[0],
      end: lastOfMonth.toISOString().split("T")[0],
    });
    fetchAccountInvoices(account.id);
    setDialogMode("invoices");
  };

  const handleGenerateInvoice = async () => {
    if (!selectedAccount) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/b2b-accounts/${selectedAccount.id}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingPeriodStart: invoicePeriod.start,
          billingPeriodEnd: invoicePeriod.end,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate invoice");
      }
      toast.success("Invoice generated");
      fetchAccountInvoices(selectedAccount.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate invoice");
    } finally {
      setSaving(false);
    }
  };

  const handleSendInvoice = async (invoiceId: string) => {
    setInvoiceActionLoading(invoiceId);
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/send`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send invoice");
      }
      toast.success("Invoice sent to billing contact");
      if (selectedAccount) fetchAccountInvoices(selectedAccount.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send invoice");
    } finally {
      setInvoiceActionLoading(null);
    }
  };

  const handleInvoiceStatusChange = async (invoiceId: string, newStatus: string) => {
    setInvoiceActionLoading(invoiceId);
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update invoice");
      }
      toast.success(`Invoice marked as ${newStatus}`);
      if (selectedAccount) fetchAccountInvoices(selectedAccount.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update invoice");
    } finally {
      setInvoiceActionLoading(null);
    }
  };

  const invoiceStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      issued: "outline",
      paid: "default",
      overdue: "destructive",
      void: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      active: "default",
      pending: "secondary",
      suspended: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">B2B Accounts</h1>
          <p className="text-sm text-muted-foreground">{total} accounts total</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Account
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Accounts
            </CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by company..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchAccounts}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p>Failed to load accounts</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={fetchAccounts}>
                Retry
              </Button>
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Building2 className="h-8 w-8 mb-2" />
              <p>No B2B accounts found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contract</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.companyName}</TableCell>
                      <TableCell>
                        <div className="text-sm">{account.contactName}</div>
                        <div className="text-xs text-muted-foreground">{account.contactEmail}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{account.paymentTerms.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell>{statusBadge(account.status)}</TableCell>
                      <TableCell>
                        {account.contract ? (
                          <Badge variant="outline" className="text-xs">
                            {account.contract.startDate} — {account.contract.endDate}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(account.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openDetail(account)} title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(account)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openContract(account)} title="Contract">
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openBooking(account)} title="New Booking">
                            <BookOpen className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openInvoices(account)} title="Invoices">
                            <Receipt className="h-4 w-4" />
                          </Button>
                          {account.status === "active" ? (
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleStatusChange(account, "suspended")}>
                              Suspend
                            </Button>
                          ) : account.status === "suspended" ? (
                            <Button variant="ghost" size="sm" onClick={() => handleStatusChange(account, "active")}>
                              Activate
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Account Dialog */}
      <Dialog open={dialogMode === "create" || dialogMode === "edit"} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? "Create B2B Account" : "Edit B2B Account"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Company Name</Label>
              <Input value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Contact Name</Label>
                <Input value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Contact Email</Label>
                <Input type="email" value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Contact Phone</Label>
                <Input value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Payment Terms</Label>
                <Select value={formData.paymentTerms} onValueChange={(v) => setFormData({ ...formData, paymentTerms: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prepaid">Prepaid</SelectItem>
                    <SelectItem value="net_30">Net 30</SelectItem>
                    <SelectItem value="net_60">Net 60</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Street Address</Label>
              <Input value={formData.street} onChange={(e) => setFormData({ ...formData, street: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>City</Label>
                <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>State</Label>
                <Input value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>ZIP</Label>
                <Input value={formData.zip} onChange={(e) => setFormData({ ...formData, zip: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes (optional)</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
            <Button onClick={dialogMode === "create" ? handleCreate : handleUpdate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialogMode === "create" ? "Create Account" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={dialogMode === "detail"} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedAccount?.companyName}</DialogTitle>
          </DialogHeader>
          {selectedAccount && (
            <div className="grid gap-3 py-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                {statusBadge(selectedAccount.status)}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contact</span>
                <span>{selectedAccount.contactName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{selectedAccount.contactEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span>{selectedAccount.contactPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Terms</span>
                <span>{selectedAccount.paymentTerms.replace("_", " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Address</span>
                <span className="text-right">
                  {selectedAccount.billingAddress.street}, {selectedAccount.billingAddress.city}, {selectedAccount.billingAddress.state} {selectedAccount.billingAddress.zip}
                </span>
              </div>
              {selectedAccount.bookingCount !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bookings</span>
                  <span>{selectedAccount.bookingCount}</span>
                </div>
              )}
              {selectedAccount.contract && (
                <div className="mt-2 rounded-md border p-3">
                  <p className="font-medium mb-2">Contract</p>
                  <div className="grid gap-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Retainer</span>
                      <span>{formatPrice(selectedAccount.contract.retainerAmountCents)}</span>
                    </div>
                    {selectedAccount.contract.perJobRateCents && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Per-job Rate</span>
                        <span>{formatPrice(selectedAccount.contract.perJobRateCents)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Period</span>
                      <span>{selectedAccount.contract.startDate} — {selectedAccount.contract.endDate}</span>
                    </div>
                  </div>
                </div>
              )}
              {selectedAccount.notes && (
                <div className="mt-2">
                  <p className="text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{selectedAccount.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Contract Dialog */}
      <Dialog open={dialogMode === "contract"} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contract — {selectedAccount?.companyName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Retainer Amount (cents)</Label>
              <Input
                type="number"
                value={contractData.retainerAmountCents}
                onChange={(e) => setContractData({ ...contractData, retainerAmountCents: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">{formatPrice(contractData.retainerAmountCents)}</p>
            </div>
            <div className="grid gap-2">
              <Label>Per-job Rate (cents, optional)</Label>
              <Input
                type="number"
                value={contractData.perJobRateCents}
                onChange={(e) => setContractData({ ...contractData, perJobRateCents: e.target.value })}
                placeholder="Leave empty for no override"
              />
              {contractData.perJobRateCents && (
                <p className="text-xs text-muted-foreground">{formatPrice(parseInt(contractData.perJobRateCents))}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Included Service IDs (comma-separated)</Label>
              <Input
                value={contractData.includedServiceIds}
                onChange={(e) => setContractData({ ...contractData, includedServiceIds: e.target.value })}
                placeholder="service-id-1, service-id-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={contractData.startDate}
                  onChange={(e) => setContractData({ ...contractData, startDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={contractData.endDate}
                  onChange={(e) => setContractData({ ...contractData, endDate: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={handleContractUpdate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Contract
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoices Dialog */}
      <Dialog open={dialogMode === "invoices"} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoices — {selectedAccount?.companyName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-end gap-4 rounded-md border p-3">
              <div className="grid gap-1 flex-1">
                <Label className="text-xs">Billing Period Start</Label>
                <Input
                  type="date"
                  value={invoicePeriod.start}
                  onChange={(e) => setInvoicePeriod({ ...invoicePeriod, start: e.target.value })}
                />
              </div>
              <div className="grid gap-1 flex-1">
                <Label className="text-xs">Billing Period End</Label>
                <Input
                  type="date"
                  value={invoicePeriod.end}
                  onChange={(e) => setInvoicePeriod({ ...invoicePeriod, end: e.target.value })}
                />
              </div>
              <Button onClick={handleGenerateInvoice} disabled={saving || !invoicePeriod.start || !invoicePeriod.end}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Generate
              </Button>
            </div>

            {invoicesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : accountInvoices.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No invoices found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                      <TableCell className="text-xs">
                        {inv.billingPeriodStart && inv.billingPeriodEnd
                          ? `${inv.billingPeriodStart} — ${inv.billingPeriodEnd}`
                          : "—"}
                      </TableCell>
                      <TableCell>{formatPrice(inv.total)}</TableCell>
                      <TableCell className="text-xs">
                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>{invoiceStatusBadge(inv.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {inv.status === "draft" && (
                            <Button variant="ghost" size="icon" onClick={() => handleSendInvoice(inv.id)} disabled={invoiceActionLoading === inv.id} title="Send to billing contact">
                              {invoiceActionLoading === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                          )}
                          {inv.status === "issued" && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleInvoiceStatusChange(inv.id, "paid")} disabled={invoiceActionLoading === inv.id} title="Mark paid">
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleInvoiceStatusChange(inv.id, "overdue")} disabled={invoiceActionLoading === inv.id} title="Mark overdue">
                                <Clock className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" asChild title="View invoice">
                            <a href={`/api/admin/invoices/${inv.id}/html`} target="_blank" rel="noopener noreferrer">
                              <Eye className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Dialog */}
      <Dialog open={dialogMode === "booking"} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Booking — {selectedAccount?.companyName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Service</Label>
              <Select value={bookingData.serviceId} onValueChange={(v) => setBookingData({ ...bookingData, serviceId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Resident/Customer Name</Label>
                <Input value={bookingData.contactName} onChange={(e) => setBookingData({ ...bookingData, contactName: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input value={bookingData.contactPhone} onChange={(e) => setBookingData({ ...bookingData, contactPhone: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input type="email" value={bookingData.contactEmail} onChange={(e) => setBookingData({ ...bookingData, contactEmail: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Location Address</Label>
              <Input value={bookingData.address} onChange={(e) => setBookingData({ ...bookingData, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="grid gap-2">
                <Label>Year</Label>
                <Input value={bookingData.year} onChange={(e) => setBookingData({ ...bookingData, year: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Make</Label>
                <Input value={bookingData.make} onChange={(e) => setBookingData({ ...bookingData, make: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Model</Label>
                <Input value={bookingData.model} onChange={(e) => setBookingData({ ...bookingData, model: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Color</Label>
                <Input value={bookingData.color} onChange={(e) => setBookingData({ ...bookingData, color: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes (optional)</Label>
              <Textarea value={bookingData.notes} onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })} rows={2} />
            </div>
            <Button onClick={handleCreateBooking} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Booking
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

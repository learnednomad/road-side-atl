"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerSearch } from "./customer-search";
import { SaveCustomerDialog } from "./save-customer-dialog";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface LineItem {
  description: string;
  details: string;
  quantity: number;
  unitPrice: number; // in dollars for display
}

interface InvoiceFormProps {
  role: "provider" | "admin";
  invoiceId?: string; // for editing
}

export function InvoiceForm({ role, invoiceId }: InvoiceFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(!!invoiceId);

  // Customer
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", details: "", quantity: 1, unitPrice: 0 },
  ]);

  // Dates
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState("");

  // Payment
  const [paymentTerms, setPaymentTerms] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [taxRate, setTaxRate] = useState(0); // basis points
  const [notes, setNotes] = useState("");

  // Save customer dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [pendingSaveCustomer, setPendingSaveCustomer] = useState(false);

  // Load business settings defaults
  useEffect(() => {
    fetch("/api/business-settings")
      .then((r) => r.json())
      .then((settings) => {
        if (settings) {
          if (!paymentTerms && settings.defaultPaymentTerms)
            setPaymentTerms(settings.defaultPaymentTerms);
          if (!paymentMethod && settings.defaultPaymentMethod)
            setPaymentMethod(settings.defaultPaymentMethod);
          if (!paymentInstructions && settings.defaultPaymentInstructions)
            setPaymentInstructions(settings.defaultPaymentInstructions);
          if (taxRate === 0 && settings.defaultTaxRate)
            setTaxRate(settings.defaultTaxRate);
        }
      })
      .catch(() => {});
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load existing invoice for editing
  useEffect(() => {
    if (!invoiceId) return;
    setLoadingInvoice(true);
    fetch(`/api/invoices/${invoiceId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          toast.error(data.error);
          return;
        }
        setCustomerId(data.customerId);
        setCustomerName(data.customerName || "");
        setCustomerEmail(data.customerEmail || "");
        setCustomerPhone(data.customerPhone || "");
        setCustomerCompany(data.customerCompany || "");
        setCustomerAddress(data.customerAddress || "");
        setIssueDate(
          data.issueDate
            ? new Date(data.issueDate).toISOString().split("T")[0]
            : ""
        );
        setDueDate(
          data.dueDate
            ? new Date(data.dueDate).toISOString().split("T")[0]
            : ""
        );
        setPaymentTerms(data.paymentTerms || "");
        setPaymentMethod(data.paymentMethod || "");
        setPaymentInstructions(data.paymentInstructions || "");
        setTaxRate(data.taxRate || 0);
        setNotes(data.notes || "");
        if (data.lineItems && data.lineItems.length > 0) {
          setLineItems(
            data.lineItems.map((item: any) => ({
              description: item.description,
              details: item.details || "",
              quantity: item.quantity,
              unitPrice: item.unitPrice / 100, // convert cents to dollars
            }))
          );
        }
      })
      .catch(() => toast.error("Failed to load invoice"))
      .finally(() => setLoadingInvoice(false));
  }, [invoiceId]);

  const updateLineItem = (
    index: number,
    field: keyof LineItem,
    value: string | number
  ) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { description: "", details: "", quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate totals
  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * Math.round(item.unitPrice * 100),
    0
  );
  const taxAmount = Math.round((subtotal * taxRate) / 10000);
  const total = subtotal + taxAmount;

  const submitInvoice = useCallback(
    async (saveCustomer: boolean) => {
      if (!customerName.trim()) {
        toast.error("Customer name is required");
        return;
      }
      if (lineItems.some((item) => !item.description.trim())) {
        toast.error("All line items need a description");
        return;
      }

      setLoading(true);
      try {
        const payload = {
          customerId: customerId || undefined,
          customerName,
          customerEmail: customerEmail || undefined,
          customerPhone: customerPhone || undefined,
          customerCompany: customerCompany || undefined,
          customerAddress: customerAddress || undefined,
          issueDate: issueDate
            ? new Date(issueDate).toISOString()
            : undefined,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          lineItems: lineItems.map((item) => ({
            description: item.description,
            details: item.details || undefined,
            quantity: item.quantity,
            unitPrice: Math.round(item.unitPrice * 100), // dollars to cents
          })),
          taxRate,
          paymentTerms: paymentTerms || undefined,
          paymentMethod: paymentMethod || undefined,
          paymentInstructions: paymentInstructions || undefined,
          notes: notes || undefined,
          saveCustomer,
        };

        const url = invoiceId
          ? `/api/invoices/${invoiceId}`
          : "/api/invoices";
        const method = invoiceId ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          toast.success(
            invoiceId ? "Invoice updated" : "Invoice created"
          );
          const basePath = role === "admin" ? "/admin" : "/provider";
          router.push(`${basePath}/invoices`);
        } else {
          const err = await res.json();
          toast.error(err.error || "Failed to save invoice");
        }
      } catch {
        toast.error("Network error");
      }
      setLoading(false);
    },
    [
      customerId,
      customerName,
      customerEmail,
      customerPhone,
      customerCompany,
      customerAddress,
      issueDate,
      dueDate,
      lineItems,
      taxRate,
      paymentTerms,
      paymentMethod,
      paymentInstructions,
      notes,
      invoiceId,
      role,
      router,
    ]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // If no customerId and has email, prompt to save
    if (!customerId && customerEmail && !invoiceId) {
      setShowSaveDialog(true);
      return;
    }

    submitInvoice(false);
  };

  if (loadingInvoice) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Section */}
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Search Existing Customers</Label>
              <CustomerSearch
                onSelect={(customer) => {
                  setCustomerId(customer.id);
                  setCustomerName(customer.name || "");
                  setCustomerEmail(customer.email || "");
                  setCustomerPhone(customer.phone || "");
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Or type below for a one-off customer
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="customerName">Name *</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    if (customerId) setCustomerId(null);
                  }}
                  required
                />
              </div>
              <div>
                <Label htmlFor="customerEmail">Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="customerPhone">Phone</Label>
                <Input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="customerCompany">Company</Label>
                <Input
                  id="customerCompany"
                  value={customerCompany}
                  onChange={(e) => setCustomerCompany(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="customerAddress">Address</Label>
              <Input
                id="customerAddress"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lineItems.map((item, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-md border p-3 sm:grid-cols-[2fr_1.5fr_80px_100px_auto]"
              >
                <div>
                  <Label className="text-xs">Description *</Label>
                  <Input
                    value={item.description}
                    onChange={(e) =>
                      updateLineItem(index, "description", e.target.value)
                    }
                    placeholder="Service description"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">Details</Label>
                  <Input
                    value={item.details}
                    onChange={(e) =>
                      updateLineItem(index, "details", e.target.value)
                    }
                    placeholder="Model / additional info"
                  />
                </div>
                <div>
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateLineItem(
                        index,
                        "quantity",
                        parseInt(e.target.value) || 1
                      )
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Unit Price ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice || ""}
                    onChange={(e) =>
                      updateLineItem(
                        index,
                        "unitPrice",
                        parseFloat(e.target.value) || 0
                      )
                    }
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1 text-right">
                    <Label className="text-xs">Total</Label>
                    <p className="mt-1 text-sm font-medium">
                      {formatPrice(
                        item.quantity * Math.round(item.unitPrice * 100)
                      )}
                    </p>
                  </div>
                  {lineItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mb-0.5 shrink-0"
                      onClick={() => removeLineItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLineItem}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Line Item
            </Button>
          </CardContent>
        </Card>

        {/* Dates & Payment */}
        <Card>
          <CardHeader>
            <CardTitle>Dates & Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="issueDate">Issue Date</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Select
                  value={paymentTerms}
                  onValueChange={setPaymentTerms}
                >
                  <SelectTrigger id="paymentTerms">
                    <SelectValue placeholder="Select terms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Due on Receipt">
                      Due on Receipt
                    </SelectItem>
                    <SelectItem value="Net 15">Net 15</SelectItem>
                    <SelectItem value="Net 30">Net 30</SelectItem>
                    <SelectItem value="Net 60">Net 60</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Input
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  placeholder="e.g. Bank Transfer, Check, CashApp"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="paymentInstructions">Payment Instructions</Label>
              <Textarea
                id="paymentInstructions"
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                placeholder="Additional payment instructions..."
                rows={2}
              />
            </div>

            <div className="w-48">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={(taxRate / 100).toFixed(2)}
                onChange={(e) =>
                  setTaxRate(
                    Math.round(parseFloat(e.target.value || "0") * 100)
                  )
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for the invoice..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Summary & Submit */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-end gap-1">
              <div className="flex w-48 justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex w-48 justify-between text-sm">
                  <span>Tax ({(taxRate / 100).toFixed(2)}%):</span>
                  <span className="font-medium">{formatPrice(taxAmount)}</span>
                </div>
              )}
              <div className="flex w-48 justify-between border-t pt-1 text-base font-bold">
                <span>Total:</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {invoiceId ? "Update Invoice" : "Create Invoice"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <SaveCustomerDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        customerName={customerName}
        customerEmail={customerEmail}
        onSave={() => {
          setShowSaveDialog(false);
          submitInvoice(true);
        }}
        onSkip={() => {
          setShowSaveDialog(false);
          submitInvoice(false);
        }}
      />
    </>
  );
}

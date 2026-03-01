"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoUpload } from "./logo-upload";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Building2,
  Landmark,
  FileText,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Hash,
  Globe,
  Receipt,
  Percent,
  Clock,
  StickyNote,
} from "lucide-react";

export function BusinessSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Company
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Banking
  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankRoutingNumber, setBankRoutingNumber] = useState("");
  const [bankSwiftCode, setBankSwiftCode] = useState("");

  // Defaults
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState("");
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState("");
  const [defaultPaymentInstructions, setDefaultPaymentInstructions] =
    useState("");
  const [defaultTaxRate, setDefaultTaxRate] = useState(0);
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [invoiceFooterNote, setInvoiceFooterNote] = useState("");

  useEffect(() => {
    fetch("/api/business-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setCompanyName(data.companyName || "");
          setCompanyAddress(data.companyAddress || "");
          setCompanyPhone(data.companyPhone || "");
          setCompanyEmail(data.companyEmail || "");
          setLogoUrl(data.logoUrl || null);
          setBankName(data.bankName || "");
          setBankAccountName(data.bankAccountName || "");
          setBankAccountNumber(data.bankAccountNumber || "");
          setBankRoutingNumber(data.bankRoutingNumber || "");
          setBankSwiftCode(data.bankSwiftCode || "");
          setDefaultPaymentTerms(data.defaultPaymentTerms || "");
          setDefaultPaymentMethod(data.defaultPaymentMethod || "");
          setDefaultPaymentInstructions(
            data.defaultPaymentInstructions || ""
          );
          setDefaultTaxRate(data.defaultTaxRate || 0);
          setInvoicePrefix(data.invoicePrefix || "INV");
          setInvoiceFooterNote(data.invoiceFooterNote || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/business-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          companyAddress: companyAddress || undefined,
          companyPhone: companyPhone || undefined,
          companyEmail: companyEmail || undefined,
          logoUrl: logoUrl || undefined,
          bankName: bankName || undefined,
          bankAccountName: bankAccountName || undefined,
          bankAccountNumber: bankAccountNumber || undefined,
          bankRoutingNumber: bankRoutingNumber || undefined,
          bankSwiftCode: bankSwiftCode || undefined,
          defaultPaymentTerms: defaultPaymentTerms || undefined,
          defaultPaymentMethod: defaultPaymentMethod || undefined,
          defaultPaymentInstructions:
            defaultPaymentInstructions || undefined,
          defaultTaxRate,
          invoicePrefix: invoicePrefix || undefined,
          invoiceFooterNote: invoiceFooterNote || undefined,
        }),
      });

      if (res.ok) {
        toast.success("Settings saved");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save settings");
      }
    } catch {
      toast.error("Network error");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Company Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Your business identity shown on invoices and customer communications.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <LogoUpload currentUrl={logoUrl} onUploaded={setLogoUrl} />

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName" className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                Company Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="RoadSide ATL"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyEmail" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Company Email
              </Label>
              <Input
                id="companyEmail"
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                placeholder="hello@roadsideatl.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyPhone" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                Phone
              </Label>
              <Input
                id="companyPhone"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                placeholder="(404) 555-0100"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyAddress" className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Address
            </Label>
            <Textarea
              id="companyAddress"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder="123 Peachtree St NW, Atlanta, GA 30303"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Banking */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Landmark className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle>Banking Information</CardTitle>
              <CardDescription>
                Bank details for receiving payments and displayed on invoices.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bankName" className="flex items-center gap-1.5">
                <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                Bank Name
              </Label>
              <Input
                id="bankName"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Chase, Bank of America, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankAccountName" className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                Account Name
              </Label>
              <Input
                id="bankAccountName"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                placeholder="Business checking account name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankAccountNumber" className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                Account Number
              </Label>
              <Input
                id="bankAccountNumber"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="xxxx-xxxx-xxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankRoutingNumber" className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                Routing Number
              </Label>
              <Input
                id="bankRoutingNumber"
                value={bankRoutingNumber}
                onChange={(e) => setBankRoutingNumber(e.target.value)}
                placeholder="9-digit routing number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankSwiftCode" className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                SWIFT Code
              </Label>
              <Input
                id="bankSwiftCode"
                value={bankSwiftCode}
                onChange={(e) => setBankSwiftCode(e.target.value)}
                placeholder="For international transfers"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Defaults */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Invoice Defaults</CardTitle>
              <CardDescription>
                Pre-fill values applied to new invoices. Can be overridden per invoice.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoicePrefix" className="flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                Invoice Prefix
              </Label>
              <Input
                id="invoicePrefix"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="INV"
              />
              <p className="text-xs text-muted-foreground">
                Invoices will be numbered like {invoicePrefix || "INV"}-2026-0001
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultTaxRate" className="flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                Default Tax Rate (%)
              </Label>
              <Input
                id="defaultTaxRate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={(defaultTaxRate / 100).toFixed(2)}
                onChange={(e) =>
                  setDefaultTaxRate(
                    Math.round(parseFloat(e.target.value || "0") * 100)
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultPaymentTerms" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Default Payment Terms
              </Label>
              <Input
                id="defaultPaymentTerms"
                value={defaultPaymentTerms}
                onChange={(e) => setDefaultPaymentTerms(e.target.value)}
                placeholder="e.g. Net 30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultPaymentMethod" className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                Default Payment Method
              </Label>
              <Input
                id="defaultPaymentMethod"
                value={defaultPaymentMethod}
                onChange={(e) => setDefaultPaymentMethod(e.target.value)}
                placeholder="e.g. Bank Transfer"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultPaymentInstructions" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Default Payment Instructions
            </Label>
            <Textarea
              id="defaultPaymentInstructions"
              value={defaultPaymentInstructions}
              onChange={(e) =>
                setDefaultPaymentInstructions(e.target.value)
              }
              placeholder="Include bank details, CashApp handle, or other payment instructions..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoiceFooterNote" className="flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
              Invoice Footer Note
            </Label>
            <Textarea
              id="invoiceFooterNote"
              value={invoiceFooterNote}
              onChange={(e) => setInvoiceFooterNote(e.target.value)}
              placeholder="Thank you for your business!"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-6 py-4">
        <p className="text-sm text-muted-foreground">
          Changes are saved immediately and apply to new invoices.
        </p>
        <Button type="submit" disabled={saving} size="lg">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Settings
        </Button>
      </div>
    </form>
  );
}

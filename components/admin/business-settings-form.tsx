"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LogoUpload } from "./logo-upload";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
    <form onSubmit={handleSave} className="space-y-6">
      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <LogoUpload currentUrl={logoUrl} onUploaded={setLogoUrl} />
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="companyEmail">Company Email</Label>
              <Input
                id="companyEmail"
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="companyPhone">Phone</Label>
              <Input
                id="companyPhone"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="companyAddress">Address</Label>
            <Textarea
              id="companyAddress"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Banking */}
      <Card>
        <CardHeader>
          <CardTitle>Banking Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bankAccountName">Account Name</Label>
              <Input
                id="bankAccountName"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bankAccountNumber">Account Number</Label>
              <Input
                id="bankAccountNumber"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bankRoutingNumber">Routing Number</Label>
              <Input
                id="bankRoutingNumber"
                value={bankRoutingNumber}
                onChange={(e) => setBankRoutingNumber(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bankSwiftCode">SWIFT Code</Label>
              <Input
                id="bankSwiftCode"
                value={bankSwiftCode}
                onChange={(e) => setBankSwiftCode(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="invoicePrefix">Invoice Prefix</Label>
              <Input
                id="invoicePrefix"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="INV"
              />
            </div>
            <div>
              <Label htmlFor="defaultTaxRate">Default Tax Rate (%)</Label>
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
            <div>
              <Label htmlFor="defaultPaymentTerms">
                Default Payment Terms
              </Label>
              <Input
                id="defaultPaymentTerms"
                value={defaultPaymentTerms}
                onChange={(e) => setDefaultPaymentTerms(e.target.value)}
                placeholder="e.g. Net 30"
              />
            </div>
            <div>
              <Label htmlFor="defaultPaymentMethod">
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
          <div>
            <Label htmlFor="defaultPaymentInstructions">
              Default Payment Instructions
            </Label>
            <Textarea
              id="defaultPaymentInstructions"
              value={defaultPaymentInstructions}
              onChange={(e) =>
                setDefaultPaymentInstructions(e.target.value)
              }
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="invoiceFooterNote">Invoice Footer Note</Label>
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

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </form>
  );
}

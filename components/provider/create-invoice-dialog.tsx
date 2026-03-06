"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface LineItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

interface CreateInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateInvoiceDialog({ open, onClose, onCreated }: CreateInvoiceDialogProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: "1", unitPrice: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  function addLineItem() {
    setLineItems([...lineItems, { description: "", quantity: "1", unitPrice: "" }]);
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  function updateLineItem(index: number, field: keyof LineItem, value: string) {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  }

  function getLineTotal(item: LineItem): number {
    const qty = parseInt(item.quantity) || 0;
    const price = Math.round(parseFloat(item.unitPrice || "0") * 100);
    return qty * price;
  }

  const subtotal = lineItems.reduce((sum, item) => sum + getLineTotal(item), 0);

  function reset() {
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setNotes("");
    setLineItems([{ description: "", quantity: "1", unitPrice: "" }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      customerName,
      customerEmail,
      customerPhone,
      lineItems: lineItems.map((item) => ({
        description: item.description,
        quantity: parseInt(item.quantity) || 1,
        unitPrice: Math.round(parseFloat(item.unitPrice || "0") * 100),
      })),
      notes: notes || undefined,
    };

    try {
      const res = await fetch("/api/provider/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Invoice created as draft");
        reset();
        onCreated();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create invoice");
      }
    } catch {
      toast.error("Failed to create invoice");
    }
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Invoice</DialogTitle>
          <DialogDescription>Create a standalone invoice for off-platform services.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Customer Information</h4>
            <div className="grid gap-2">
              <Label htmlFor="customerName">Name</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name"
                required
                minLength={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customerEmail">Email</Label>
              <Input
                id="customerEmail"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customerPhone">Phone</Label>
              <Input
                id="customerPhone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(404) 555-0100"
                required
                minLength={10}
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Line Items</h4>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-3 w-3 mr-1" />
                Add Item
              </Button>
            </div>

            {lineItems.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_60px_90px_32px] gap-2 items-end">
                <div>
                  {i === 0 && <Label className="text-xs">Description</Label>}
                  <Input
                    value={item.description}
                    onChange={(e) => updateLineItem(i, "description", e.target.value)}
                    placeholder="Service description"
                    required
                  />
                </div>
                <div>
                  {i === 0 && <Label className="text-xs">Qty</Label>}
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(i, "quantity", e.target.value)}
                    required
                  />
                </div>
                <div>
                  {i === 0 && <Label className="text-xs">Price ($)</Label>}
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateLineItem(i, "unitPrice", e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLineItem(i)}
                  disabled={lineItems.length <= 1}
                  className="h-9 w-9 p-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}

            <div className="flex justify-end pt-2 border-t">
              <div className="text-sm">
                <span className="text-muted-foreground mr-2">Total:</span>
                <span className="font-semibold">{formatPrice(subtotal)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Draft
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

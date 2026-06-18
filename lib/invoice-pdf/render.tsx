import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument } from "./invoice-document";

interface LineItem {
  description: string;
  details: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceData {
  invoiceNumber: string;
  status: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerCompany: string | null;
  customerAddress: string | null;
  issueDate: Date | string;
  dueDate: Date | string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid?: number | null; // cents; defaults to `total` when status is paid
  paymentTerms: string | null;
  paymentMethod: string | null;
  paymentInstructions: string | null;
  notes: string | null;
}

/** Optional vehicle block (from a linked booking) — SABRONMBC mechanic-receipt format. */
export interface VehicleData {
  label: string; // e.g. "2016 Kia Optima"
  vin?: string | null;
  engine?: string | null;
}

interface BusinessSettingsData {
  companyName: string;
  companyTagline?: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  logoUrl: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankRoutingNumber: string | null;
  bankSwiftCode: string | null;
  invoiceFooterNote: string | null;
  warrantySummary?: string | null;
  warrantyConditions?: string | null;
}

interface RenderOptions {
  invoice: InvoiceData;
  lineItems: LineItem[];
  businessSettings: BusinessSettingsData | null;
  vehicle?: VehicleData | null;
}

export async function renderInvoicePdf(options: RenderOptions): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <InvoiceDocument
      invoice={options.invoice}
      lineItems={options.lineItems}
      businessSettings={options.businessSettings}
      vehicle={options.vehicle ?? null}
    />
  );
  return Buffer.from(buffer);
}

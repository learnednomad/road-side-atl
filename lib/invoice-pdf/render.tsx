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
  paymentTerms: string | null;
  paymentMethod: string | null;
  paymentInstructions: string | null;
  notes: string | null;
}

interface BusinessSettingsData {
  companyName: string;
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
}

interface RenderOptions {
  invoice: InvoiceData;
  lineItems: LineItem[];
  businessSettings: BusinessSettingsData | null;
}

export async function renderInvoicePdf(options: RenderOptions): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <InvoiceDocument
      invoice={options.invoice}
      lineItems={options.lineItems}
      businessSettings={options.businessSettings}
    />
  );
  return Buffer.from(buffer);
}

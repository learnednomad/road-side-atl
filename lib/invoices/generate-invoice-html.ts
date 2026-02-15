import { BUSINESS } from "@/lib/constants";

interface InvoiceData {
  invoiceNumber: string;
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
  providerName?: string | null;
  issuedAt?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  bookingId?: string | null;
}

export function generateInvoiceHTML(data: InvoiceData): string {
  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const statusColor =
    data.status === "paid"
      ? "#22c55e"
      : data.status === "issued"
        ? "#3b82f6"
        : data.status === "void"
          ? "#ef4444"
          : "#94a3b8";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${data.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.5; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e5e5e5; }
    .logo { font-size: 28px; font-weight: bold; color: #0f172a; }
    .invoice-title { font-size: 14px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .invoice-number { font-size: 20px; font-weight: 600; color: #0f172a; text-align: right; }
    .invoice-date { font-size: 13px; color: #64748b; text-align: right; margin-top: 4px; }
    .status-badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; color: white; background: ${statusColor}; }
    .addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
    .address-block {}
    .address-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600; }
    .address-value { font-size: 14px; color: #1a1a1a; }
    .address-sub { font-size: 13px; color: #64748b; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    thead { background: #f8fafc; }
    th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e5e5; }
    th:last-child, td:last-child { text-align: right; }
    td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
    .totals { display: flex; justify-content: flex-end; }
    .totals-table { width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .total-row.final { font-size: 18px; font-weight: 600; border-top: 2px solid #e5e5e5; padding-top: 12px; margin-top: 4px; }
    .notes { margin-top: 30px; padding: 16px; background: #f8fafc; border-radius: 8px; font-size: 13px; color: #64748b; }
    .notes-label { font-weight: 600; margin-bottom: 4px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; font-size: 12px; color: #94a3b8; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">${BUSINESS.name}</div>
      <div class="invoice-title">Invoice</div>
    </div>
    <div>
      <div class="invoice-number">${data.invoiceNumber}</div>
      ${data.issuedAt ? `<div class="invoice-date">Issued: ${formatDate(data.issuedAt)}</div>` : ""}
      ${data.paidAt ? `<div class="invoice-date">Paid: ${formatDate(data.paidAt)}</div>` : ""}
      <div style="margin-top: 8px; text-align: right;">
        <span class="status-badge">${data.status}</span>
      </div>
    </div>
  </div>

  <div class="addresses">
    <div class="address-block">
      <div class="address-label">From</div>
      <div class="address-value">${BUSINESS.name}</div>
      <div class="address-sub">${BUSINESS.email}</div>
      <div class="address-sub">${BUSINESS.phone}</div>
    </div>
    <div class="address-block">
      <div class="address-label">Bill To</div>
      <div class="address-value">${data.customerName}</div>
      <div class="address-sub">${data.customerEmail}</div>
      <div class="address-sub">${data.customerPhone}</div>
    </div>
  </div>

  ${data.providerName ? `<div style="margin-bottom: 20px; font-size: 13px; color: #64748b;">Service Provider: <strong>${data.providerName}</strong></div>` : ""}

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${data.lineItems
        .map(
          (item) => `
        <tr>
          <td>${item.description}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(item.unitPrice)}</td>
          <td>${formatCurrency(item.total)}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-table">
      <div class="total-row">
        <span>Subtotal</span>
        <span>${formatCurrency(data.subtotal)}</span>
      </div>
      <div class="total-row final">
        <span>Total</span>
        <span>${formatCurrency(data.total)}</span>
      </div>
    </div>
  </div>

  ${data.notes ? `<div class="notes"><div class="notes-label">Notes</div>${data.notes}</div>` : ""}

  <div class="footer">
    <div>Thank you for choosing ${BUSINESS.name}!</div>
    <div style="margin-top: 4px;">${BUSINESS.phone} | ${BUSINESS.email}</div>
    <div style="margin-top: 4px; font-size: 11px;">${data.bookingId ? `Booking Ref: ${data.bookingId.slice(0, 8).toUpperCase()}` : "Standalone Invoice"}</div>
  </div>
</body>
</html>
`;
}

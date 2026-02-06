import { BUSINESS } from "@/lib/constants";

interface ReceiptData {
  bookingId: string;
  serviceName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicleInfo: {
    year: string;
    make: string;
    model: string;
    color: string;
  };
  location: {
    address: string;
    destination?: string;
  };
  estimatedPrice: number;
  finalPrice: number;
  paymentMethod: string;
  paymentDate: string;
  bookingDate: string;
  providerName?: string;
  towingMiles?: number;
}

export function generateReceiptHTML(data: ReceiptData): string {
  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${data.bookingId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.5; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e5e5e5; }
    .logo { font-size: 28px; font-weight: bold; color: #0f172a; }
    .receipt-title { font-size: 14px; color: #64748b; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px; }
    .receipt-number { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .info-block { }
    .info-label { font-size: 12px; color: #94a3b8; margin-bottom: 2px; }
    .info-value { font-size: 14px; color: #1a1a1a; }
    .service-box { background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .service-name { font-size: 18px; font-weight: 600; color: #0f172a; }
    .vehicle-info { font-size: 14px; color: #64748b; margin-top: 4px; }
    .location-box { background: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 12px; }
    .location-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
    .location-value { font-size: 13px; color: #1a1a1a; }
    .totals { border-top: 2px solid #e5e5e5; padding-top: 20px; margin-top: 20px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .total-row.final { font-size: 18px; font-weight: 600; border-top: 1px solid #e5e5e5; padding-top: 16px; margin-top: 8px; }
    .payment-badge { display: inline-block; background: #22c55e; color: white; font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; font-size: 12px; color: #94a3b8; }
    .footer-contact { margin-top: 8px; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">${BUSINESS.name}</div>
    <div class="receipt-title">Payment Receipt</div>
    <div class="receipt-number">Receipt #${data.bookingId.slice(0, 8).toUpperCase()}</div>
  </div>

  <div class="section">
    <div class="info-grid">
      <div class="info-block">
        <div class="info-label">Customer</div>
        <div class="info-value">${data.customerName}</div>
        <div class="info-value" style="font-size: 13px; color: #64748b;">${data.customerEmail}</div>
        <div class="info-value" style="font-size: 13px; color: #64748b;">${data.customerPhone}</div>
      </div>
      <div class="info-block" style="text-align: right;">
        <div class="info-label">Payment Date</div>
        <div class="info-value">${formatDate(data.paymentDate)}</div>
        <div style="margin-top: 8px;">
          <span class="payment-badge">Paid via ${data.paymentMethod}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Service Details</div>
    <div class="service-box">
      <div class="service-name">${data.serviceName}</div>
      <div class="vehicle-info">${data.vehicleInfo.year} ${data.vehicleInfo.make} ${data.vehicleInfo.model} (${data.vehicleInfo.color})</div>
      ${data.providerName ? `<div class="vehicle-info">Serviced by: ${data.providerName}</div>` : ""}

      <div class="location-box">
        <div class="location-label">Pickup Location</div>
        <div class="location-value">${data.location.address}</div>
      </div>

      ${data.location.destination ? `
      <div class="location-box" style="margin-top: 8px;">
        <div class="location-label">Towed To</div>
        <div class="location-value">${data.location.destination}</div>
      </div>
      ` : ""}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Payment Summary</div>
    <div class="totals">
      <div class="total-row">
        <span>Service Fee</span>
        <span>${formatCurrency(data.estimatedPrice)}</span>
      </div>
      ${data.towingMiles ? `
      <div class="total-row">
        <span>Mileage (${data.towingMiles} miles @ $3/mi)</span>
        <span>${formatCurrency(data.towingMiles * 300)}</span>
      </div>
      ` : ""}
      <div class="total-row final">
        <span>Total Paid</span>
        <span>${formatCurrency(data.finalPrice)}</span>
      </div>
    </div>
  </div>

  <div class="footer">
    <div>Thank you for choosing ${BUSINESS.name}!</div>
    <div class="footer-contact">
      ${BUSINESS.phone} | ${BUSINESS.email}
    </div>
    <div style="margin-top: 4px;">
      Booking Date: ${formatDate(data.bookingDate)}
    </div>
  </div>
</body>
</html>
`;
}

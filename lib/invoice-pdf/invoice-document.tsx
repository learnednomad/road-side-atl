import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#333" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  logo: { width: 54, height: 54, objectFit: "contain" },
  companyInfo: { gap: 1 },
  companyName: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 1 },
  tagline: { fontSize: 9, color: "#666" },
  paidBadge: {
    backgroundColor: "#16a34a",
    color: "#fff",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#1a1a1a", marginBottom: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 4 },
  metaItem: { flexDirection: "row", gap: 4 },
  bold: { fontFamily: "Helvetica-Bold" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e5e5e5", marginVertical: 12 },
  twoCol: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14, gap: 20 },
  block: { flex: 1, gap: 2 },
  sectionLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  customerName: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  paidInFull: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#16a34a",
    borderRadius: 6,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  paidInFullLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#16a34a", letterSpacing: 1 },
  paidInFullAmount: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#16a34a" },
  table: { marginBottom: 16 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  colDescription: { flex: 3 },
  colDetails: { flex: 3 },
  colQty: { width: 32, textAlign: "center" },
  colUnitPrice: { width: 72, textAlign: "right" },
  colTotal: { width: 72, textAlign: "right" },
  headerText: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#666", textTransform: "uppercase" },
  cellText: { fontSize: 10 },
  cellBold: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  totalsSection: { alignItems: "flex-end", marginBottom: 18 },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", width: 220, paddingVertical: 2 },
  totalLabel: { flex: 1, textAlign: "right", paddingRight: 15 },
  totalValue: { width: 90, textAlign: "right" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: 220,
    paddingVertical: 6,
    borderTopWidth: 2,
    borderTopColor: "#333",
    marginTop: 3,
  },
  grandTotalLabel: { flex: 1, textAlign: "right", paddingRight: 15, fontSize: 12, fontFamily: "Helvetica-Bold" },
  grandTotalValue: { width: 90, textAlign: "right", fontSize: 12, fontFamily: "Helvetica-Bold" },
  panel: { backgroundColor: "#f9f9f9", padding: 12, borderRadius: 4, marginBottom: 14, gap: 4 },
  panelTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  warrantyText: { fontSize: 8.5, color: "#444", lineHeight: 1.4 },
  signatures: { flexDirection: "row", justifyContent: "space-between", gap: 30, marginTop: 24 },
  signatureBlock: { flex: 1 },
  signatureLine: { borderTopWidth: 1, borderTopColor: "#999", marginTop: 28, paddingTop: 4 },
  signatureLabel: { fontSize: 8.5, color: "#666" },
  footer: { textAlign: "center", fontSize: 9, color: "#999", marginTop: 20 },
});

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function titleCaseStatus(status: string): string {
  if (status === "paid") return "Paid in Full";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

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
  amountPaid?: number | null;
  paymentTerms: string | null;
  paymentMethod: string | null;
  paymentInstructions: string | null;
  notes: string | null;
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

interface VehicleData {
  label: string;
  vin?: string | null;
  engine?: string | null;
}

interface InvoiceDocumentProps {
  invoice: InvoiceData;
  lineItems: LineItem[];
  businessSettings: BusinessSettingsData | null;
  vehicle?: VehicleData | null;
}

export function InvoiceDocument({
  invoice,
  lineItems,
  businessSettings: settings,
  vehicle,
}: InvoiceDocumentProps) {
  const isPaid = invoice.status === "paid";
  const docTitle = isPaid ? "RECEIPT" : "INVOICE";
  const amountPaid = invoice.amountPaid ?? (isPaid ? invoice.total : 0);
  const balanceDue = Math.max(0, invoice.total - amountPaid);
  const recipient = settings?.companyName || "Company";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {settings?.logoUrl && (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image doesn't support alt
              <Image src={settings.logoUrl} style={styles.logo} />
            )}
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{recipient}</Text>
              {!!settings?.companyTagline && <Text style={styles.tagline}>{settings.companyTagline}</Text>}
              {!!settings?.companyPhone && <Text style={styles.tagline}>Phone: {settings.companyPhone}</Text>}
            </View>
          </View>
          {isPaid && <Text style={styles.paidBadge}>PAID</Text>}
        </View>

        <Text style={styles.title}>{docTitle}</Text>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.bold}>Invoice #:</Text>
            <Text>{invoice.invoiceNumber}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.bold}>{isPaid ? "Receipt Date:" : "Date:"}</Text>
            <Text>{formatDate(invoice.issueDate)}</Text>
          </View>
          {!!invoice.paymentTerms && (
            <View style={styles.metaItem}>
              <Text style={styles.bold}>Terms:</Text>
              <Text>{invoice.paymentTerms}</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Text style={styles.bold}>Status:</Text>
            <Text>{titleCaseStatus(invoice.status)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill To + Vehicle */}
        <View style={styles.twoCol}>
          <View style={styles.block}>
            <Text style={styles.sectionLabel}>Bill To</Text>
            <Text style={styles.customerName}>{invoice.customerName}</Text>
            {!!invoice.customerCompany && <Text>{invoice.customerCompany}</Text>}
            {!!invoice.customerAddress && <Text>{invoice.customerAddress}</Text>}
            {!!invoice.customerEmail && <Text>{invoice.customerEmail}</Text>}
            {!!invoice.customerPhone && <Text>Phone: {invoice.customerPhone}</Text>}
          </View>
          {!!vehicle && (
            <View style={styles.block}>
              <Text style={styles.sectionLabel}>Vehicle Information</Text>
              <View style={styles.metaItem}>
                <Text style={styles.bold}>Vehicle:</Text>
                <Text>{vehicle.label}</Text>
              </View>
              {!!vehicle.vin && (
                <View style={styles.metaItem}>
                  <Text style={styles.bold}>VIN:</Text>
                  <Text>{vehicle.vin}</Text>
                </View>
              )}
              {!!vehicle.engine && (
                <View style={styles.metaItem}>
                  <Text style={styles.bold}>Engine:</Text>
                  <Text>{vehicle.engine}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Paid-in-full badge */}
        {isPaid && (
          <View style={styles.paidInFull}>
            <Text style={styles.paidInFullLabel}>PAID IN FULL</Text>
            <Text style={styles.paidInFullAmount}>{formatCents(amountPaid)}</Text>
          </View>
        )}

        {/* Service details */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colDescription}><Text style={styles.headerText}>Description</Text></View>
            <View style={styles.colDetails}><Text style={styles.headerText}>Details</Text></View>
            <View style={styles.colQty}><Text style={styles.headerText}>Qty</Text></View>
            <View style={styles.colUnitPrice}><Text style={styles.headerText}>Unit Price</Text></View>
            <View style={styles.colTotal}><Text style={styles.headerText}>Total</Text></View>
          </View>
          {lineItems.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={styles.colDescription}><Text style={styles.cellBold}>{item.description}</Text></View>
              <View style={styles.colDetails}><Text style={styles.cellText}>{item.details || ""}</Text></View>
              <View style={styles.colQty}><Text style={styles.cellText}>{item.quantity}</Text></View>
              <View style={styles.colUnitPrice}><Text style={styles.cellText}>{formatCents(item.unitPrice)}</Text></View>
              <View style={styles.colTotal}><Text style={styles.cellBold}>{formatCents(item.total)}</Text></View>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>{formatCents(invoice.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              Tax{invoice.taxRate > 0 ? ` (${(invoice.taxRate / 100).toFixed(2)}%)` : ""}:
            </Text>
            <Text style={styles.totalValue}>{formatCents(invoice.taxAmount)}</Text>
          </View>
          {amountPaid > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Amount Paid:</Text>
              <Text style={styles.totalValue}>({formatCents(amountPaid)})</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>{isPaid ? "Balance Due:" : "Total:"}</Text>
            <Text style={styles.grandTotalValue}>
              {isPaid ? formatCents(balanceDue) : formatCents(invoice.total)}
            </Text>
          </View>
        </View>

        {/* Payment confirmation */}
        {isPaid && (!!invoice.paymentMethod || !!invoice.paymentInstructions) && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Payment Confirmation</Text>
            {!!invoice.paymentMethod && (
              <Text>Payment received via {invoice.paymentMethod}.</Text>
            )}
            <Text>
              Paid to: {recipient}
              {settings?.companyPhone ? ` — ${settings.companyPhone}` : ""}
            </Text>
            <Text>
              <Text style={styles.bold}>Amount Paid: </Text>
              {formatCents(amountPaid)}
            </Text>
            {!!invoice.paymentInstructions && <Text style={{ marginTop: 2 }}>{invoice.paymentInstructions}</Text>}
          </View>
        )}

        {/* Unpaid: how to pay */}
        {!isPaid && (!!invoice.paymentMethod || !!invoice.paymentInstructions || !!settings?.bankName) && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Payment Information</Text>
            {!!invoice.paymentMethod && (
              <Text><Text style={styles.bold}>Method: </Text>{invoice.paymentMethod}</Text>
            )}
            {!!settings?.bankName && (
              <Text><Text style={styles.bold}>Bank: </Text>{settings.bankName}{settings.bankAccountNumber ? ` · Acct ${settings.bankAccountNumber}` : ""}{settings.bankRoutingNumber ? ` · Routing ${settings.bankRoutingNumber}` : ""}</Text>
            )}
            {!!invoice.paymentInstructions && <Text style={{ marginTop: 2 }}>{invoice.paymentInstructions}</Text>}
          </View>
        )}

        {/* Warranty */}
        {!!settings?.warrantySummary && (
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.panelTitle}>Warranty Summary</Text>
            <Text style={styles.warrantyText}>{settings.warrantySummary}</Text>
          </View>
        )}
        {!!settings?.warrantyConditions && (
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.panelTitle}>Warranty Conditions / Exclusions</Text>
            <Text style={styles.warrantyText}>{settings.warrantyConditions}</Text>
          </View>
        )}

        {/* Notes */}
        {!!invoice.notes && (
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}

        {/* Signatures */}
        <View style={styles.signatures}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureLabel}>Customer Acknowledgement Signature / Date</Text>
            </View>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureLabel}>{recipient} Representative / Date</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          {settings?.invoiceFooterNote || "Thank you for your business."}
        </Text>
      </Page>
    </Document>
  );
}

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
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#333",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 60,
    height: 60,
    objectFit: "contain",
  },
  companyInfo: {
    gap: 2,
  },
  companyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 3,
  },
  invoiceTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    marginVertical: 15,
  },
  billToSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  billToBlock: {
    gap: 3,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  colDescription: { flex: 3 },
  colDetails: { flex: 2 },
  colQty: { width: 40, textAlign: "center" },
  colUnitPrice: { width: 80, textAlign: "right" },
  colTotal: { width: 80, textAlign: "right" },
  headerText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#666",
    textTransform: "uppercase",
  },
  cellText: {
    fontSize: 10,
  },
  cellBold: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  totalsSection: {
    alignItems: "flex-end",
    marginBottom: 25,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: 200,
    paddingVertical: 3,
  },
  totalLabel: {
    flex: 1,
    textAlign: "right",
    paddingRight: 15,
  },
  totalValue: {
    width: 80,
    textAlign: "right",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: 200,
    paddingVertical: 6,
    borderTopWidth: 2,
    borderTopColor: "#333",
    marginTop: 3,
  },
  grandTotalLabel: {
    flex: 1,
    textAlign: "right",
    paddingRight: 15,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  grandTotalValue: {
    width: 80,
    textAlign: "right",
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  paymentSection: {
    backgroundColor: "#f9f9f9",
    padding: 15,
    borderRadius: 4,
    marginBottom: 20,
    gap: 6,
  },
  paymentTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 9,
    color: "#999",
  },
});

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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

interface InvoiceDocumentProps {
  invoice: InvoiceData;
  lineItems: LineItem[];
  businessSettings: BusinessSettingsData | null;
}

export function InvoiceDocument({
  invoice,
  lineItems,
  businessSettings: settings,
}: InvoiceDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {settings?.logoUrl && (
              <Image src={settings.logoUrl} style={styles.logo} />
            )}
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>
                {settings?.companyName || "Company"}
              </Text>
              {settings?.companyAddress && (
                <Text>{settings.companyAddress}</Text>
              )}
              {settings?.companyPhone && <Text>{settings.companyPhone}</Text>}
              {settings?.companyEmail && <Text>{settings.companyEmail}</Text>}
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Invoice #: </Text>
              {invoice.invoiceNumber}
            </Text>
            <Text>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Date: </Text>
              {formatDate(invoice.issueDate)}
            </Text>
            {invoice.dueDate && (
              <Text>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Due: </Text>
                {formatDate(invoice.dueDate)}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill To */}
        <View style={styles.billToSection}>
          <View style={styles.billToBlock}>
            <Text style={styles.sectionLabel}>Bill To</Text>
            <Text style={styles.customerName}>{invoice.customerName}</Text>
            {invoice.customerCompany && (
              <Text>{invoice.customerCompany}</Text>
            )}
            {invoice.customerAddress && (
              <Text>{invoice.customerAddress}</Text>
            )}
            {invoice.customerEmail && <Text>{invoice.customerEmail}</Text>}
            {invoice.customerPhone && <Text>{invoice.customerPhone}</Text>}
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colDescription}>
              <Text style={styles.headerText}>Description</Text>
            </View>
            <View style={styles.colDetails}>
              <Text style={styles.headerText}>Details</Text>
            </View>
            <View style={styles.colQty}>
              <Text style={styles.headerText}>Qty</Text>
            </View>
            <View style={styles.colUnitPrice}>
              <Text style={styles.headerText}>Unit Price</Text>
            </View>
            <View style={styles.colTotal}>
              <Text style={styles.headerText}>Total</Text>
            </View>
          </View>
          {lineItems.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={styles.colDescription}>
                <Text style={styles.cellBold}>{item.description}</Text>
              </View>
              <View style={styles.colDetails}>
                <Text style={styles.cellText}>{item.details || ""}</Text>
              </View>
              <View style={styles.colQty}>
                <Text style={styles.cellText}>{item.quantity}</Text>
              </View>
              <View style={styles.colUnitPrice}>
                <Text style={styles.cellText}>
                  {formatCents(item.unitPrice)}
                </Text>
              </View>
              <View style={styles.colTotal}>
                <Text style={styles.cellBold}>{formatCents(item.total)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>
              {formatCents(invoice.subtotal)}
            </Text>
          </View>
          {invoice.taxRate > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Tax ({(invoice.taxRate / 100).toFixed(2)}%):
              </Text>
              <Text style={styles.totalValue}>
                {formatCents(invoice.taxAmount)}
              </Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total:</Text>
            <Text style={styles.grandTotalValue}>
              {formatCents(invoice.total)}
            </Text>
          </View>
        </View>

        {/* Payment Section */}
        {(invoice.paymentTerms ||
          invoice.paymentMethod ||
          invoice.paymentInstructions ||
          settings?.bankName) && (
          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>Payment Information</Text>
            {invoice.paymentTerms && (
              <Text>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Terms: </Text>
                {invoice.paymentTerms}
              </Text>
            )}
            {invoice.paymentMethod && (
              <Text>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Method: </Text>
                {invoice.paymentMethod}
              </Text>
            )}
            {settings?.bankName && (
              <>
                <Text>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>Bank: </Text>
                  {settings.bankName}
                </Text>
                {settings.bankAccountName && (
                  <Text>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>
                      Account Name:{" "}
                    </Text>
                    {settings.bankAccountName}
                  </Text>
                )}
                {settings.bankAccountNumber && (
                  <Text>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>
                      Account #:{" "}
                    </Text>
                    {settings.bankAccountNumber}
                  </Text>
                )}
                {settings.bankRoutingNumber && (
                  <Text>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>
                      Routing #:{" "}
                    </Text>
                    {settings.bankRoutingNumber}
                  </Text>
                )}
                {settings.bankSwiftCode && (
                  <Text>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>
                      SWIFT:{" "}
                    </Text>
                    {settings.bankSwiftCode}
                  </Text>
                )}
              </>
            )}
            {invoice.paymentInstructions && (
              <Text style={{ marginTop: 4 }}>
                {invoice.paymentInstructions}
              </Text>
            )}
          </View>
        )}

        {/* Notes */}
        {invoice.notes && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        {settings?.invoiceFooterNote && (
          <Text style={styles.footer}>{settings.invoiceFooterNote}</Text>
        )}
      </Page>
    </Document>
  );
}

import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { InspectionFinding } from "@/db/schema/inspection-reports";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica" },
  header: { marginBottom: 20, borderBottomWidth: 2, borderBottomColor: "#1a1a2e", paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1a1a2e" },
  subtitle: { fontSize: 12, color: "#666", marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", marginTop: 16, marginBottom: 8, color: "#1a1a2e" },
  finding: { marginBottom: 12, padding: 10, backgroundColor: "#f8f8f8", borderRadius: 4 },
  findingHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  component: { fontSize: 12, fontWeight: "bold" },
  condition: { fontSize: 10, padding: "2 6", borderRadius: 3 },
  conditionGood: { backgroundColor: "#d4edda", color: "#155724" },
  conditionFair: { backgroundColor: "#fff3cd", color: "#856404" },
  conditionPoor: { backgroundColor: "#f8d7da", color: "#721c24" },
  conditionCritical: { backgroundColor: "#721c24", color: "#fff" },
  description: { fontSize: 11, color: "#333", marginTop: 4 },
  measurement: { fontSize: 10, color: "#666", marginTop: 2 },
  obdCode: { fontSize: 10, color: "#0066cc", marginTop: 2 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 9, color: "#999", textAlign: "center" },
  vehicleInfo: { fontSize: 12, marginBottom: 4 },
});

function getConditionStyle(condition: string) {
  switch (condition) {
    case "good": return styles.conditionGood;
    case "fair": return styles.conditionFair;
    case "poor": return styles.conditionPoor;
    case "critical": return styles.conditionCritical;
    default: return {};
  }
}

interface ReportData {
  inspectionDate: string;
  vehicleInfo: { year: string; make: string; model: string; color: string };
  providerName: string;
  findings: InspectionFinding[];
  bookingId: string;
}

export async function generateInspectionPDF(data: ReportData): Promise<Buffer> {
  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "LETTER", style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.title }, "RoadSide ATL"),
        React.createElement(Text, { style: styles.subtitle }, "Vehicle Inspection Report"),
        React.createElement(Text, { style: styles.subtitle }, `Date: ${data.inspectionDate}`),
        React.createElement(Text, { style: styles.subtitle }, `Inspector: ${data.providerName}`),
        React.createElement(Text, { style: styles.subtitle }, `Ref: #${data.bookingId.slice(0, 8)}`)
      ),
      // Vehicle Info
      React.createElement(
        View,
        null,
        React.createElement(Text, { style: styles.sectionTitle }, "Vehicle Information"),
        React.createElement(
          Text,
          { style: styles.vehicleInfo },
          `${data.vehicleInfo.year} ${data.vehicleInfo.make} ${data.vehicleInfo.model} (${data.vehicleInfo.color})`
        )
      ),
      // Findings
      React.createElement(
        View,
        null,
        React.createElement(Text, { style: styles.sectionTitle }, "Inspection Findings"),
        ...data.findings.map((finding, i) =>
          React.createElement(
            View,
            { key: String(i), style: styles.finding },
            React.createElement(
              View,
              { style: styles.findingHeader },
              React.createElement(Text, { style: styles.component }, `${finding.category} — ${finding.component}`),
              React.createElement(
                Text,
                { style: { ...styles.condition, ...getConditionStyle(finding.condition) } },
                finding.condition.toUpperCase()
              )
            ),
            React.createElement(Text, { style: styles.description }, finding.description),
            finding.measurement
              ? React.createElement(Text, { style: styles.measurement }, `Measurement: ${finding.measurement}`)
              : null,
            finding.obdCode
              ? React.createElement(Text, { style: styles.obdCode }, `OBD Code: ${finding.obdCode}`)
              : null
          )
        )
      ),
      // Footer
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(Text, null, "RoadSide ATL — Atlanta's Premium Roadside Assistance — roadsideatl.com")
      )
    )
  );

  const buffer = await renderToBuffer(doc);
  return Buffer.from(buffer);
}

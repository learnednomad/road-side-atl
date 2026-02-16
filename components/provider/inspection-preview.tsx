"use client";

import type { InspectionFinding } from "@/db/schema/inspection-reports";

interface InspectionPreviewProps {
  findings: InspectionFinding[];
  vehicleInfo?: { year?: string; make?: string; model?: string; color?: string };
  providerName: string;
  inspectionDate: string;
  bookingId: string;
}

const conditionColors: Record<string, { bg: string; text: string }> = {
  good: { bg: "bg-green-100", text: "text-green-800" },
  fair: { bg: "bg-yellow-100", text: "text-yellow-800" },
  poor: { bg: "bg-orange-100", text: "text-orange-800" },
  critical: { bg: "bg-red-100", text: "text-red-800" },
};

export function InspectionPreview({
  findings,
  vehicleInfo,
  providerName,
  inspectionDate,
  bookingId,
}: InspectionPreviewProps) {
  // Group findings by category
  const grouped = findings.reduce<Record<string, InspectionFinding[]>>((acc, finding) => {
    const key = finding.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(finding);
    return acc;
  }, {});

  const vehicleDescription = vehicleInfo
    ? [vehicleInfo.year, vehicleInfo.make, vehicleInfo.model].filter(Boolean).join(" ")
    : null;

  const worstCondition = findings.reduce<string>((worst, f) => {
    const order = ["good", "fair", "poor", "critical"];
    return order.indexOf(f.condition) > order.indexOf(worst) ? f.condition : worst;
  }, "good");

  return (
    <div className="mx-auto max-w-3xl rounded-lg border bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900">Vehicle Inspection Report</h2>
        <p className="mt-1 text-sm text-gray-500">Booking #{bookingId.slice(0, 8)}</p>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4">
        {vehicleDescription && (
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Vehicle</p>
            <p className="text-sm font-semibold text-gray-900">{vehicleDescription}</p>
            {vehicleInfo?.color && (
              <p className="text-xs text-gray-500">Color: {vehicleInfo.color}</p>
            )}
          </div>
        )}
        <div>
          <p className="text-xs font-medium uppercase text-gray-500">Inspector</p>
          <p className="text-sm font-semibold text-gray-900">{providerName}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-gray-500">Date</p>
          <p className="text-sm font-semibold text-gray-900">{inspectionDate}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-gray-500">Overall Status</p>
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${conditionColors[worstCondition]?.bg ?? ""} ${conditionColors[worstCondition]?.text ?? ""}`}
          >
            {worstCondition}
          </span>
        </div>
      </div>

      {/* Findings by Category */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Findings ({findings.length})
        </h3>

        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
              {category}
            </h4>
            <div className="space-y-3">
              {items.map((finding, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border p-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{finding.component}</p>
                      <p className="mt-1 text-sm text-gray-600">{finding.description}</p>
                    </div>
                    <span
                      className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${conditionColors[finding.condition]?.bg ?? ""} ${conditionColors[finding.condition]?.text ?? ""}`}
                    >
                      {finding.condition}
                    </span>
                  </div>
                  {(finding.measurement || finding.obdCode) && (
                    <div className="mt-2 flex gap-4 text-xs text-gray-500">
                      {finding.measurement && (
                        <span>Measurement: {finding.measurement}</span>
                      )}
                      {finding.obdCode && (
                        <span>OBD Code: {finding.obdCode}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-8 border-t pt-4 text-center text-xs text-gray-400">
        <p>RoadSide ATL — Vehicle Inspection Report</p>
      </div>
    </div>
  );
}

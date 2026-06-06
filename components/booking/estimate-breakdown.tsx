import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function EstimateBreakdown({
  basePrice,
  estimateMinCents,
  estimateMaxCents,
  estimateNote,
}: {
  basePrice: number;
  estimateMinCents?: number | null;
  estimateMaxCents?: number | null;
  estimateNote?: string | null;
}) {
  const hasRange = estimateMinCents != null && estimateMaxCents != null;

  return (
    <Card className="mt-4 border-red-200 bg-red-50/40">
      <CardContent className="pt-6">
        <div className="mb-3 flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div className="text-sm font-semibold">Your transparent estimate</div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Base service price</span>
            <span className="font-semibold tabular-nums">{formatCents(basePrice)}</span>
          </div>
          {hasRange && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Typical Atlanta range</span>
              <span className="font-semibold tabular-nums">
                {formatCents(estimateMinCents)}–{formatCents(estimateMaxCents)}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2">
            <span className="text-muted-foreground">Final price</span>
            <span className="font-semibold">Quoted on-site after assessment</span>
          </div>
        </div>
        {estimateNote && (
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="font-medium">Note:</span> {estimateNote}
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Vehicle class, parts grade, and after-hours service can move the final
          price. Your mechanic will confirm before starting work.
        </p>
      </CardContent>
    </Card>
  );
}

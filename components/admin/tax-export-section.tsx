"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExportButton } from "./export-button";
import { FileSpreadsheet } from "lucide-react";

export function TaxExportSection() {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const [year, setYear] = useState(currentYear.toString());
  const [qualifyingCount, setQualifyingCount] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/admin/providers/1099-count?year=${year}`)
      .then((res) => res.json())
      .then((data) => setQualifyingCount(data.count ?? 0))
      .catch(() => setQualifyingCount(null));
  }, [year]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-4 w-4" />
          1099 Export
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ExportButton
            endpoint={`/api/admin/providers/1099-export?year=${year}`}
            filename={`1099-export-${year}.csv`}
            label="Export 1099 Data"
          />
        </div>
        {qualifyingCount !== null && (
          <p className="text-sm text-muted-foreground">
            {qualifyingCount} provider{qualifyingCount !== 1 ? "s" : ""} qualifying
            (earnings &ge; $600) for {year}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  FileText,
  Mail,
} from "lucide-react";

interface InspectionData {
  report: {
    id: string;
    bookingId: string;
    findings: {
      category: string;
      component: string;
      condition: string;
      description: string;
    }[];
    emailedAt: string | null;
    createdAt: string;
  };
  booking: {
    id: string;
    contactName: string;
    contactEmail: string;
    vehicleInfo: {
      year: string;
      make: string;
      model: string;
      color: string;
    };
  };
  service: {
    name: string;
  };
}

export default function ProviderInspectionsPage() {
  const [reports, setReports] = useState<InspectionData[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(
        `/api/inspection-reports/provider/list?page=${page}&limit=20`
      );
      if (res.ok) {
        const data = await res.json();
        setReports(data.data || []);
        setTotalPages(data.totalPages || 1);
      } else {
        setFetchError(true);
      }
    } catch {
      setFetchError(true);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleSendEmail = async (reportId: string) => {
    setSendingEmail(reportId);
    try {
      const res = await fetch(`/api/inspection-reports/${reportId}/email`, {
        method: "POST",
      });
      if (res.ok) {
        fetchReports();
      }
    } catch {
      // silent fail
    }
    setSendingEmail(null);
  };

  const conditionColor = (condition: string) => {
    switch (condition) {
      case "critical":
        return "destructive";
      case "poor":
        return "destructive";
      case "fair":
        return "default";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Inspection Reports</h1>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Findings</TableHead>
              <TableHead>Emailed</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : fetchError ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                    <p className="text-sm text-muted-foreground">
                      Failed to load reports.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchReports}
                    >
                      <RefreshCw className="mr-2 h-3 w-3" /> Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : reports.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No inspection reports yet.
                </TableCell>
              </TableRow>
            ) : (
              reports.map(({ report, booking, service }) => {
                const vehicle = booking.vehicleInfo;
                const worstCondition = report.findings.reduce((worst, f) => {
                  const order = { good: 0, fair: 1, poor: 2, critical: 3 };
                  return (order[f.condition as keyof typeof order] || 0) >
                    (order[worst as keyof typeof order] || 0)
                    ? f.condition
                    : worst;
                }, "good");
                return (
                  <TableRow key={report.id}>
                    <TableCell className="text-sm">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {booking.contactName}
                    </TableCell>
                    <TableCell className="text-sm">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {report.findings.length} items
                        </span>
                        <Badge
                          variant={
                            conditionColor(worstCondition) as
                              | "destructive"
                              | "default"
                              | "secondary"
                          }
                        >
                          {worstCondition}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={report.emailedAt ? "default" : "secondary"}
                      >
                        {report.emailedAt ? "Sent" : "Not sent"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(
                              `/api/inspection-reports/${report.id}/pdf`,
                              "_blank"
                            )
                          }
                        >
                          <FileText className="mr-1 h-3 w-3" /> PDF
                        </Button>
                        {!report.emailedAt && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendEmail(report.id)}
                            disabled={sendingEmail === report.id}
                          >
                            {sendingEmail === report.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Mail className="mr-1 h-3 w-3" />
                            )}
                            Email
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

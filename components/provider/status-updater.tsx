"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { BookingStatus } from "@/lib/constants";

interface StatusUpdaterProps {
  bookingId: string;
  currentStatus: BookingStatus;
  onStatusChange?: (newStatus: BookingStatus) => void;
}

const statusTransitions: Record<string, BookingStatus[]> = {
  dispatched: ["in_progress"],
  confirmed: ["in_progress"],
  in_progress: ["completed"],
};

const statusLabels: Record<string, string> = {
  in_progress: "Start Job",
  completed: "Complete Job",
};

export function StatusUpdater({ bookingId, currentStatus, onStatusChange }: StatusUpdaterProps) {
  const [loading, setLoading] = useState(false);
  const nextStatuses = statusTransitions[currentStatus] || [];

  if (nextStatuses.length === 0) return null;

  async function handleStatusUpdate(newStatus: BookingStatus) {
    setLoading(true);
    try {
      const res = await fetch(`/api/provider/jobs/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Status updated to ${newStatus.replace("_", " ")}`);
        onStatusChange?.(newStatus);
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      {nextStatuses.map((status) => (
        <Button
          key={status}
          onClick={() => handleStatusUpdate(status)}
          disabled={loading}
          size="sm"
        >
          {loading ? "Updating..." : statusLabels[status] || status.replace("_", " ")}
        </Button>
      ))}
    </div>
  );
}

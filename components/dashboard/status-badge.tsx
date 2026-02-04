import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/constants";

const statusConfig: Record<
  BookingStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "secondary" },
  confirmed: { label: "Confirmed", variant: "default" },
  dispatched: { label: "Dispatched", variant: "default" },
  in_progress: { label: "In Progress", variant: "default" },
  completed: { label: "Completed", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const config = statusConfig[status] || statusConfig.pending;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

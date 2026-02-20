"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { BookingStatus } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";

interface JobCardProps {
  booking: {
    id: string;
    status: BookingStatus;
    contactName: string;
    contactPhone: string;
    estimatedPrice: number;
    location: { address: string };
    vehicleInfo: { year: string; make: string; model: string; color: string };
  };
  serviceName: string;
  onAccept?: () => void;
  onReject?: () => void;
  showActions?: boolean;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  dispatched: "bg-purple-100 text-purple-800",
  in_progress: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function JobCard({ booking, serviceName, onAccept, onReject, showActions = false }: JobCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">{booking.contactName}</h3>
              <Badge className={statusColors[booking.status] || ""}>
                {booking.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{serviceName}</p>
            <p className="text-sm text-muted-foreground truncate">{booking.location.address}</p>
            <p className="text-sm text-muted-foreground">
              {booking.vehicleInfo.year} {booking.vehicleInfo.make} {booking.vehicleInfo.model} ({booking.vehicleInfo.color})
            </p>
            <p className="text-sm font-medium">{formatPrice(booking.estimatedPrice)}</p>
          </div>

          {showActions && (booking.status === "dispatched" || booking.status === "confirmed") && (
            <div className="flex gap-2 shrink-0">
              {onAccept && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm">Accept</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Accept Job</AlertDialogTitle>
                      <AlertDialogDescription>
                        Accept this job for {booking.contactName} at {booking.location.address}? You will be dispatched to the customer&apos;s location.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onAccept}>Accept Job</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {onReject && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      Reject
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reject Job</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to reject this job? The customer will need to be reassigned to another provider.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onReject}>
                        Reject Job
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

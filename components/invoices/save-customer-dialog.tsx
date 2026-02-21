"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SaveCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  customerEmail: string;
  onSave: () => void;
  onSkip: () => void;
}

export function SaveCustomerDialog({
  open,
  onOpenChange,
  customerName,
  customerEmail,
  onSave,
  onSkip,
}: SaveCustomerDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save this customer?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{customerName}</strong>
            {customerEmail && ` (${customerEmail})`} is not in your customer
            database. Would you like to save them for future invoices?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onSkip}>No, skip</AlertDialogCancel>
          <AlertDialogAction onClick={onSave}>
            Yes, save customer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

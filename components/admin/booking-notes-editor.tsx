"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BookingNotesEditorProps {
  bookingId: string;
  initialNotes: string;
}

export function BookingNotesEditor({ bookingId, initialNotes }: BookingNotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/admin/bookings/${bookingId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSaving(false);
    if (res.ok) toast.success("Notes saved");
    else toast.error("Failed to save notes");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Internal Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add internal notes (not visible to customers)..."
          rows={4}
          maxLength={2000}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{notes.length}/2000</p>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Notes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

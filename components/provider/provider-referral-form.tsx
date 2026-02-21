"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function ProviderReferralForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const res = await fetch("/api/referrals/provider-refer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refereeEmail: email, refereeName: name, refereePhone: phone || undefined }),
    });

    if (res.ok) {
      setSuccess(true);
      setEmail("");
      setName("");
      setPhone("");
      onSuccess();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to submit referral");
    }

    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Refer a Provider</CardTitle>
        <CardDescription>Refer another provider and earn $10 credit when they complete their first job.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="ref-name">Name</Label>
            <Input id="ref-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="ref-email">Email</Label>
            <Input id="ref-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="ref-phone">Phone (optional)</Label>
            <Input id="ref-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600">Referral submitted successfully!</p>}
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Referral
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

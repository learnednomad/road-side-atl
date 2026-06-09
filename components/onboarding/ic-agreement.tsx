"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { IcAgreementPayload } from "@/lib/ic-agreement-content";

interface IcAgreementResponse {
  agreement: IcAgreementPayload;
  step: {
    id: string;
    status: string;
    acceptedVersion: string | null;
    acceptedAt: string | null;
    signedName: string | null;
  } | null;
}

export function IcAgreement({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<IcAgreementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAgreement = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/ic-agreement");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load agreement (${res.status})`);
      }
      const json: IcAgreementResponse = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agreement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgreement();
  }, [fetchAgreement]);

  const handleAccept = async () => {
    if (!data) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/ic-agreement/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: data.agreement.version,
          signedName: signedName.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Failed to accept (${res.status})`);
      }
      await fetchAgreement();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept agreement");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchAgreement(); }}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { agreement, step } = data;

  // No IC-agreement step on file (e.g. an already-active provider opening this
  // page directly) — nothing to sign.
  if (!step) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
          <h2 className="text-xl font-semibold">No Agreement Required</h2>
          <p className="text-center text-sm text-muted-foreground max-w-md">
            There&apos;s no Independent Contractor Agreement pending on your account.
          </p>
          <Button variant="outline" onClick={onBack}>Back to onboarding</Button>
        </CardContent>
      </Card>
    );
  }

  const alreadyAccepted = step.status === "complete";

  if (alreadyAccepted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
          <h2 className="text-xl font-semibold">Agreement Accepted</h2>
          <p className="text-center text-sm text-muted-foreground max-w-md">
            You accepted version {step.acceptedVersion} as <strong>{step.signedName}</strong>
            {step.acceptedAt ? ` on ${new Date(step.acceptedAt).toLocaleDateString()}` : ""}.
          </p>
          <Button variant="outline" onClick={onBack}>Back to onboarding</Button>
        </CardContent>
      </Card>
    );
  }

  const canSubmit = confirmed && signedName.trim().length >= 2 && !submitting;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{agreement.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Version {agreement.version}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-6 py-6">
          {agreement.sections.map((section) => (
            <section key={section.id}>
              <h2 className="font-semibold mb-2">{section.heading}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {section.body}
              </p>
            </section>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accept Agreement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{agreement.disclaimer}</p>

          <div className="flex items-start gap-2">
            <Checkbox
              id="ic-confirm"
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(v === true)}
              disabled={submitting}
            />
            <Label htmlFor="ic-confirm" className="text-sm leading-snug font-normal cursor-pointer">
              I have read and agree to all sections of this Independent Contractor Agreement.
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ic-signed-name">Full legal name (signature)</Label>
            <Input
              id="ic-signed-name"
              value={signedName}
              onChange={(e) => setSignedName(e.target.value)}
              placeholder="e.g. Jane Smith"
              disabled={submitting}
              autoComplete="name"
            />
          </div>

          {error && (
            <div className="flex items-start gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={onBack} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleAccept} disabled={!canSubmit}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Accept &amp; Sign
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

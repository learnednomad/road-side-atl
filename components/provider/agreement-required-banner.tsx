"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileSignature } from "lucide-react";

export function AgreementRequiredBanner() {
  const [needsSigning, setNeedsSigning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/onboarding/ic-agreement")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        // step:null means no agreement is on file for this provider (e.g. active /
        // fully-onboarded) — nothing to sign. Only nudge when a step exists and is
        // not yet complete.
        setNeedsSigning(!!data.step && data.step.status !== "complete");
      })
      .catch(() => {
        // Silent fail — banner is a nudge, not a hard gate. Server middleware
        // is the authoritative block on job acceptance.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!needsSigning) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
    >
      <FileSignature className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">
        Action required: sign the Independent Contractor Agreement to accept new jobs.
      </span>
      <Link
        href="/provider/onboarding/agreement"
        className="rounded-md bg-amber-900 px-3 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-950 dark:bg-amber-200 dark:text-amber-900 dark:hover:bg-amber-100"
      >
        Sign now
      </Link>
    </div>
  );
}

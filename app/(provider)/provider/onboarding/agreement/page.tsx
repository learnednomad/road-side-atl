"use client";

import { useRouter } from "next/navigation";
import { IcAgreement } from "@/components/onboarding/ic-agreement";

export default function IcAgreementPage() {
  const router = useRouter();

  return (
    <div className="container max-w-3xl py-8">
      <IcAgreement onBack={() => router.push("/provider/onboarding")} />
    </div>
  );
}

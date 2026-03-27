"use client";

import { useRouter } from "next/navigation";
import { TrainingModule } from "@/components/onboarding/training-cards";

export default function TrainingPage() {
  const router = useRouter();

  return (
    <div className="container max-w-3xl py-8">
      <TrainingModule onBack={() => router.push("/provider/onboarding")} />
    </div>
  );
}

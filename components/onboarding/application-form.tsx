"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { providerApplicationSchema } from "@/lib/validators";
import type { ProviderApplicationInput } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const SPECIALTIES_OPTIONS = [
  "Tire Change",
  "Jump Start",
  "Lockout",
  "Fuel Delivery",
  "Towing",
  "Diagnostics",
];

export function ApplicationForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const inviteToken = searchParams.get("invite");
  const isInvite = !!inviteToken;

  const [isSubmitting, setIsSubmitting] = useState(false);

  // For invite flow, name/email come from the invite — don't validate them client-side
  const formSchema = isInvite
    ? providerApplicationSchema.omit({ name: true, email: true })
    : providerApplicationSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProviderApplicationInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- formSchema narrowed via .omit() for invite flow
    resolver: zodResolver(formSchema as any),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      phone: "",
      serviceArea: [],
      specialties: [],
      fcraConsent: false as unknown as true,
    },
  });

  const selectedSpecialties = watch("specialties") || [];
  const fcraConsent = watch("fcraConsent");

  async function onSubmit(data: ProviderApplicationInput) {
    setIsSubmitting(true);

    try {
      const endpoint = isInvite ? "/api/onboarding/invite-accept" : "/api/onboarding/apply";
      const body = isInvite
        ? { inviteToken, password: data.password, phone: data.phone, serviceArea: data.serviceArea, specialties: data.specialties, fcraConsent: data.fcraConsent }
        : data;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Application failed. Please try again.");
        return;
      }

      const result = await res.json();
      toast.success("Application submitted successfully!");

      // Auto-login after successful registration
      const loginEmail = isInvite ? result.provider?.email : data.email;
      const loginResult = await signIn("credentials", {
        email: loginEmail,
        password: data.password,
        redirect: false,
      });

      if (loginResult?.ok) {
        router.push("/provider/onboarding");
      } else {
        router.push("/login?registered=true");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleSpecialty(specialty: string) {
    const current = selectedSpecialties as string[];
    const updated = current.includes(specialty)
      ? current.filter((s) => s !== specialty)
      : [...current, specialty];
    setValue("specialties", updated);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isInvite ? "Complete Your Registration" : "Provider Application"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {!isInvite && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" {...register("name")} placeholder="John Doe" />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email")} placeholder="john@example.com" />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register("password")} placeholder="Min 8 characters" />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" type="tel" {...register("phone")} placeholder="(404) 555-0123" />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="serviceArea">Service Area</Label>
            <Input
              id="serviceArea"
              {...register("serviceArea.0")}
              placeholder="e.g., Atlanta ITP, Midtown, Buckhead"
            />
            <p className="text-xs text-muted-foreground">Enter your primary service area</p>
            {errors.serviceArea && (
              <p className="text-sm text-destructive">
                {(errors.serviceArea as { message?: string })?.message || "At least one service area is required"}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Specialties</Label>
            <div className="grid grid-cols-2 gap-2">
              {SPECIALTIES_OPTIONS.map((specialty) => (
                <label
                  key={specialty}
                  className="flex cursor-pointer items-center gap-2 rounded-md border p-3 hover:bg-accent"
                >
                  <Checkbox
                    checked={(selectedSpecialties as string[]).includes(specialty)}
                    onCheckedChange={() => toggleSpecialty(specialty)}
                  />
                  <span className="text-sm">{specialty}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={fcraConsent === true}
                onCheckedChange={(checked) =>
                  setValue("fcraConsent", checked === true ? true : (false as unknown as true), { shouldValidate: true })
                }
                className="mt-0.5"
              />
              <div className="space-y-1">
                <span className="text-sm font-medium">Background Check Authorization (FCRA)</span>
                <p className="text-xs text-muted-foreground">
                  I authorize RoadSide ATL to obtain a consumer report and/or investigative consumer report
                  about me for employment purposes in compliance with the Fair Credit Reporting Act (FCRA).
                  I understand that this report may include information about my character, general reputation,
                  personal characteristics, and criminal history.
                </p>
              </div>
            </label>
            {errors.fcraConsent && (
              <p className="mt-2 text-sm text-destructive">{errors.fcraConsent.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Application"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

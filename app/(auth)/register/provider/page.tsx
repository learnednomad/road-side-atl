"use client";

import { useState } from "react";
import posthog from "posthog-js";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Check, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { ServiceAreaPicker } from "@/components/provider/service-area-picker";

const SPECIALTY_OPTIONS = [
  "Towing",
  "Jump Start",
  "Flat Tire",
  "Lockout",
  "Fuel Delivery",
  "Winch Out",
  "Diagnostics",
];

const PITCH_POINTS = [
  "Set your own hours — accept the jobs you want",
  "Dispatch across the entire Atlanta metro, ITP and OTP",
  "Transparent payouts on every completed job",
  "Live job tracking and in-app navigation",
];

function FormSection({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-neutral-200 py-8 first:border-t-0 first:pt-0">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="font-mono text-sm text-neutral-400">{num}</span>
        <h2 className="text-lg font-semibold tracking-tight text-neutral-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function ProviderRegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  function toggleSpecialty(s: string) {
    setSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/provider-registration/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          password,
          specialties: specialties.length > 0 ? specialties : undefined,
          serviceArea: serviceAreas.length > 0 ? serviceAreas : undefined,
          address: address || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      posthog.capture(ANALYTICS_EVENTS.PROVIDER_REGISTRATION_SUBMITTED, {
        email,
        specialties,
        service_areas: serviceAreas,
      });
      setRegistered(true);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (registered) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9f6] px-4">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-10 text-center">
          <p className="flex items-center justify-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">
            <span aria-hidden className="h-3 w-0.5 bg-red-600" />
            Application submitted
          </p>
          <div className="mx-auto mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-950">
            <Mail aria-hidden className="h-6 w-6 text-white" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-neutral-950">
            Check your email
          </h1>
          <p className="mt-3 text-neutral-600">
            We&apos;ve sent a verification link to{" "}
            <span className="font-medium text-neutral-950">{email}</span>
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Verify your email, then an admin will review your application and
            activate your account.
          </p>
          <Button
            asChild
            className="mt-8 rounded-full bg-neutral-950 px-7 font-mono text-xs uppercase tracking-wider hover:bg-neutral-800"
          >
            <Link href="/login">Go to Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <div className="container mx-auto px-4 py-12 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
          {/* Pitch panel */}
          <div className="lg:sticky lg:top-16 lg:self-start">
            <Link href="/" className="text-xl font-bold text-neutral-950">
              RoadSide <span className="text-red-600">GA</span>
            </Link>
            <p className="mt-10 flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">
              <span aria-hidden className="h-3 w-0.5 bg-red-600" />
              Become a provider
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-neutral-950 md:text-5xl">
              Earn on your own schedule
            </h1>
            <p className="mt-4 max-w-md text-neutral-600">
              Join Atlanta&apos;s modern roadside platform. Apply in minutes —
              we&apos;ll verify your details and get you on the road.
            </p>
            <ul className="mt-8 space-y-4">
              {PITCH_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-neutral-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-950">
                    <Check aria-hidden className="h-3 w-3 text-white" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-10 space-y-1 border-t border-neutral-200 pt-6 text-sm text-neutral-500">
              <p>
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-neutral-950 underline-offset-4 hover:underline">
                  Sign in
                </Link>
              </p>
              <p>
                Looking for customer registration?{" "}
                <Link href="/register" className="font-medium text-neutral-950 underline-offset-4 hover:underline">
                  Register here
                </Link>
              </p>
            </div>
          </div>

          {/* Application form */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 md:p-10">
            {error && (
              <p
                role="alert"
                aria-live="assertive"
                className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit}>
              <FormSection num="01" title="Your details">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Your full name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(404) 555-0199"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="At least 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                    </div>
                  </div>
                </div>
              </FormSection>

              <FormSection num="02" title="What you do">
                <Label className="sr-only">Specialties (optional)</Label>
                <p className="mb-3 text-sm text-neutral-500">
                  Pick your specialties — optional, you can add more later.
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Service specialties">
                  {SPECIALTY_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpecialty(s)}
                      aria-pressed={specialties.includes(s)}
                      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                        specialties.includes(s)
                          ? "border-neutral-950 bg-neutral-950 text-white"
                          : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </FormSection>

              <FormSection num="03" title="Where you work">
                <ServiceAreaPicker selected={serviceAreas} onChange={setServiceAreas} />
              </FormSection>

              <div className="border-t border-neutral-200 pt-8">
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="w-full rounded-full bg-red-600 py-6 font-mono text-sm uppercase tracking-wider hover:bg-red-700 sm:w-auto sm:px-10"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Application
                  {!loading && <ArrowRight aria-hidden className="ml-2 h-4 w-4" />}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

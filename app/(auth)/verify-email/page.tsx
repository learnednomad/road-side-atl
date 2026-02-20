"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";

function ResendVerificationForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/auth-routes/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to send. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <p className="text-sm text-green-600">
        If an account exists for that email, a new verification link has been sent.
      </p>
    );
  }

  return (
    <form onSubmit={handleResend} className="space-y-2 text-left">
      <Label htmlFor="resend-email">Email address</Label>
      <div className="flex gap-2">
        <Input
          id="resend-email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button type="submit" size="sm" disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend"}
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("no-token");
      return;
    }

    async function verifyEmail() {
      try {
        const res = await fetch("/api/auth-routes/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setStatus("success");
          setMessage(data.email ? `Email ${data.email} verified!` : "Email verified!");
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed");
        }
      } catch {
        setStatus("error");
        setMessage("An error occurred. Please try again.");
      }
    }

    verifyEmail();
  }, [token]);

  if (status === "loading") {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Verifying your email...</p>
        </CardContent>
      </Card>
    );
  }

  if (status === "no-token") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Email Verification</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <Mail className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">
            No verification token provided. Please check your email for the verification link.
          </p>
          <Button asChild>
            <Link href="/login">Go to Login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-green-600">Email Verified!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <CheckCircle2 aria-hidden="true" className="h-16 w-16 mx-auto text-green-600" />
          <p className="text-muted-foreground">{message}</p>
          <p className="text-sm text-muted-foreground">
            You can now sign in to your account.
          </p>
          <Button asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center text-red-600">Verification Failed</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <XCircle aria-hidden="true" className="h-16 w-16 mx-auto text-red-600" />
        <p className="text-muted-foreground">{message}</p>
        <p className="text-sm text-muted-foreground">
          Your verification link may have expired. Enter your email below to receive a new one.
        </p>
        <ResendVerificationForm />
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Go to Login</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardContent className="py-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            </CardContent>
          </Card>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}

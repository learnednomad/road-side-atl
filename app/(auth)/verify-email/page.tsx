"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- token check short-circuit
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
          <CheckCircle2 className="h-16 w-16 mx-auto text-green-600" />
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
        <XCircle className="h-16 w-16 mx-auto text-red-600" />
        <p className="text-muted-foreground">{message}</p>
        <div className="space-y-2">
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Go to Login</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Need a new verification link? Sign in and request one from your account settings.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
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

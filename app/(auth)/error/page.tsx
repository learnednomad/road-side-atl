import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Error | RoadSide ATL",
};

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle aria-hidden="true" className="h-6 w-6 text-destructive" />
          </div>
          <Link href="/" className="text-xl font-bold">
            RoadSide ATL
          </Link>
          <CardTitle>Authentication Error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p role="alert" className="text-sm text-muted-foreground">
            Something went wrong during sign in. Please try again.
          </p>
          <Button asChild className="w-full">
            <Link href="/login">Try Again</Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            <Link href="/register" className="text-primary hover:underline">
              Create an account
            </Link>
            {" or "}
            <Link href="/forgot-password" className="text-primary hover:underline">
              reset your password
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

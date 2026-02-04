import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Error | RoadSide ATL",
};

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Authentication Error</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            Something went wrong during sign in. Please try again.
          </p>
          <Link href="/login">
            <Button className="w-full">Try Again</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

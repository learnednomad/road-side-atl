import { Metadata } from "next";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign In | RoadSide ATL",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Link href="/" className="mb-2 text-xl font-bold">
            RoadSide ATL
          </Link>
          <CardTitle>Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              Continue with Google
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Sign in to view your booking history and manage appointments.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Sign In | RoadSide GA",
  description:
    "Sign in to your RoadSide GA account to manage bookings, track service requests, and access your dashboard.",
  path: "/login",
  noindex: true,
});

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

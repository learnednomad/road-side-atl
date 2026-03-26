import { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Sign In | RoadSide ATL",
  description:
    "Sign in to your RoadSide ATL account to manage bookings, track service requests, and access your dashboard.",
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

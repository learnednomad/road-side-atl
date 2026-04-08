import { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Create Account | RoadSide GA",
  description:
    "Create your free RoadSide GA account to book roadside assistance, track service requests, and manage your vehicles in Atlanta.",
  path: "/register",
  noindex: true,
});

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

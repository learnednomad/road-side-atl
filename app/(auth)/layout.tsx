import { Metadata } from "next";

export const metadata: Metadata = {
  // Per-page title via template (avoids the double "RoadSide GA" the old static
  // "Sign In | RoadSide GA" produced once the root template appended the brand).
  title: {
    default: "Sign In",
    template: "%s | RoadSide GA",
  },
  description:
    "Sign in to your RoadSide GA account to manage bookings, track service requests, and access your dashboard.",
  robots: { index: false, follow: false },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

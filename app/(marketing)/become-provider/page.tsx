import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Become a Provider | RoadSide GA",
  description: "Apply to join RoadSide GA as a roadside assistance and mechanics provider in Atlanta.",
};

export default function BecomeProviderPage() {
  redirect("/register/provider");
}

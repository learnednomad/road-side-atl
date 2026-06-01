import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Become a Provider | RoadSide ATL",
  description: "Apply to join RoadSide ATL as a roadside assistance and mechanics provider in Atlanta.",
};

export default function BecomeProviderPage() {
  redirect("/register/provider");
}

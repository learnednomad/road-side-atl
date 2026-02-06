import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MyBookingsClient } from "./my-bookings-client";

export const metadata = {
  title: "My Bookings | RoadSide ATL",
  description: "View and manage your roadside assistance bookings",
};

export default async function MyBookingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/my-bookings");
  }

  return <MyBookingsClient />;
}

import { Metadata } from "next";
import { BusinessSettingsForm } from "@/components/admin/business-settings-form";

export const metadata: Metadata = {
  title: "Settings | Admin | RoadSide ATL",
};

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Business Settings</h1>
      <BusinessSettingsForm />
    </div>
  );
}

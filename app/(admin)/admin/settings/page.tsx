import { Metadata } from "next";
import { BusinessSettingsForm } from "@/components/admin/business-settings-form";

export const metadata: Metadata = {
  title: "Settings | Admin | RoadSide ATL",
};

export default function AdminSettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Business Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your company profile, banking details, and invoice defaults.
        </p>
      </div>
      <BusinessSettingsForm />
    </div>
  );
}

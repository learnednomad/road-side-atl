import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AuditLogsClient } from "./audit-logs-client";

export default async function AuditLogsPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">
          Track all system activity and admin actions
        </p>
      </div>
      <AuditLogsClient />
    </div>
  );
}

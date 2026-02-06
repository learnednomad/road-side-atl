import { Metadata } from "next";
import { ProvidersTable } from "@/components/admin/providers-table";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Providers | Admin | RoadSide ATL",
};

export default async function AdminProvidersPage() {
  const allProviders = await db
    .select()
    .from(providers)
    .orderBy(desc(providers.createdAt));

  const serialized = allProviders.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Service Providers</h1>
      <ProvidersTable providers={serialized as any} />
    </div>
  );
}

"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProviderPipeline } from "@/components/admin/provider-pipeline";

export function ProvidersPageTabs({ children }: { children: React.ReactNode }) {
  return (
    <Tabs defaultValue="all">
      <TabsList>
        <TabsTrigger value="all">All Providers</TabsTrigger>
        <TabsTrigger value="pipeline">Onboarding Pipeline</TabsTrigger>
      </TabsList>
      <TabsContent value="all" className="mt-4">
        {children}
      </TabsContent>
      <TabsContent value="pipeline" className="mt-4">
        <ProviderPipeline />
      </TabsContent>
    </Tabs>
  );
}

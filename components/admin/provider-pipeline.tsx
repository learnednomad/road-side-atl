"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useWebSocket } from "@/lib/hooks/use-websocket";
import { OnboardingDetailPanel } from "./onboarding-detail-panel";
import { toast } from "sonner";
import { ArrowUpDown, Search, RefreshCw } from "lucide-react";

interface PipelineProvider {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  userName: string | null;
  userEmail: string | null;
  completedSteps: number;
  totalSteps: number;
  createdAt: string;
  userId: string | null;
}

interface PipelineData {
  stages: Record<string, PipelineProvider[]>;
  total: number;
}

const STAGE_LABELS: Record<string, string> = {
  applied: "Applied",
  documents_pending: "Documents Pending",
  background_check: "Background Check",
  stripe_setup: "Stripe Setup",
  training: "Training",
  ready_for_review: "Ready for Review",
};

const STAGE_COLORS: Record<string, string> = {
  applied: "bg-gray-100 text-gray-800",
  documents_pending: "bg-yellow-100 text-yellow-800",
  background_check: "bg-blue-100 text-blue-800",
  stripe_setup: "bg-purple-100 text-purple-800",
  training: "bg-orange-100 text-orange-800",
  ready_for_review: "bg-green-100 text-green-800",
};

export function ProviderPipeline() {
  const { data: session } = useSession();
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"date_desc" | "date_asc">("date_desc");
  const [selectedProvider, setSelectedProvider] = useState<PipelineProvider | null>(null);

  const { lastEvent } = useWebSocket({
    userId: session?.user?.id,
    role: session?.user?.role,
    enabled: !!session?.user?.id,
  });

  const fetchPipeline = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (stageFilter !== "all") params.set("stage", stageFilter);
    params.set("sort", sortOrder);

    const res = await fetch(`/api/admin/providers/pipeline?${params}`);
    if (res.ok) {
      const data = await res.json();
      setPipeline(data);
    } else {
      toast.error("Failed to load pipeline data");
    }
    setIsLoading(false);
  }, [search, stageFilter, sortOrder]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    void fetchPipeline();
  }, [fetchPipeline]);

  useEffect(() => {
    if (!lastEvent) return;
    const refreshEvents = [
      "onboarding:new_submission",
      "onboarding:step_updated",
      "onboarding:document_reviewed",
      "onboarding:ready_for_review",
      "onboarding:activated",
    ];
    if (refreshEvents.includes(lastEvent.type)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- refresh on WS event
      void fetchPipeline();
    }
  }, [lastEvent, fetchPipeline]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    fetchPipeline();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-10" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (selectedProvider) {
    return (
      <OnboardingDetailPanel
        provider={selectedProvider}
        onBack={() => {
          setSelectedProvider(null);
          fetchPipeline();
        }}
      />
    );
  }

  const stages = pipeline?.stages || {};

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </form>
        <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); setIsLoading(true); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {Object.entries(STAGE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSortOrder((s) => s === "date_desc" ? "date_asc" : "date_desc")}
          title={sortOrder === "date_desc" ? "Newest first" : "Oldest first"}
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => { setIsLoading(true); fetchPipeline(); }}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{pipeline?.total || 0} providers in pipeline</span>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="flex w-full flex-wrap gap-1">
          <TabsTrigger value="all">
            All ({pipeline?.total || 0})
          </TabsTrigger>
          {Object.entries(STAGE_LABELS).map(([key, label]) => (
            <TabsTrigger key={key} value={key}>
              {label} ({(stages[key] || []).length})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(stages).flatMap(([stageKey, providers]) =>
              (providers as PipelineProvider[]).map((p) => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  stage={stageKey}
                  onClick={() => setSelectedProvider(p)}
                />
              ))
            )}
            {pipeline?.total === 0 && (
              <p className="col-span-full py-8 text-center text-muted-foreground">
                No providers in the onboarding pipeline.
              </p>
            )}
          </div>
        </TabsContent>

        {Object.entries(STAGE_LABELS).map(([key]) => (
          <TabsContent key={key} value={key} className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(stages[key] as PipelineProvider[] || []).map((p) => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  stage={key}
                  onClick={() => setSelectedProvider(p)}
                />
              ))}
              {(stages[key] || []).length === 0 && (
                <p className="col-span-full py-8 text-center text-muted-foreground">
                  No providers in this stage.
                </p>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ProviderCard({
  provider,
  stage,
  onClick,
}: {
  provider: PipelineProvider;
  stage: string;
  onClick: () => void;
}) {
  const nextAction = getNextAction(stage);

  return (
    <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={onClick}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium">{provider.name}</CardTitle>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[stage] || ""}`}>
            {STAGE_LABELS[stage]}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{provider.email}</p>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            {provider.completedSteps}/{provider.totalSteps} steps
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(provider.createdAt).toLocaleDateString()}
          </span>
        </div>
        {nextAction && (
          <p className="text-xs font-medium text-blue-600">{nextAction}</p>
        )}
      </CardContent>
    </Card>
  );
}

function getNextAction(stage: string): string {
  switch (stage) {
    case "applied": return "Review application";
    case "documents_pending": return "Awaiting document uploads";
    case "background_check": return "Background check pending";
    case "stripe_setup": return "Stripe setup needed";
    case "training": return "Training incomplete";
    case "ready_for_review": return "Ready to activate";
    default: return "";
  }
}

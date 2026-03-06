"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

interface HealthCheck {
  status: string;
  latency?: number;
}

interface HealthData {
  status: string;
  checks: Record<string, HealthCheck>;
  wsConnections: number;
  timestamp: string;
}

const STATUS_COLORS: Record<string, string> = {
  healthy: "bg-green-500",
  unhealthy: "bg-red-500",
  degraded: "bg-yellow-500",
  unconfigured: "bg-gray-400",
};

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status] || "bg-gray-400"}`}
    />
  );
}

export function HealthWidget() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    function fetchHealth() {
      fetch("/api/health")
        .then((res) => res.json())
        .then((data) => { setHealth(data); setError(false); })
        .catch(() => { setHealth(null); setError(true); });
    }

    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4" />
          System Health
          {health && <StatusDot status={health.status} />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!health ? (
          <p className="text-sm text-muted-foreground">{error ? "Unavailable" : "Loading..."}</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(health.checks).map(([name, check]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <StatusDot status={check.status} />
                  <span className="capitalize">{name}</span>
                </div>
                {check.latency !== undefined && check.latency > 0 && (
                  <span className="text-xs text-muted-foreground">{check.latency}ms</span>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between border-t pt-2 text-sm">
              <span className="text-muted-foreground">WebSocket Connections</span>
              <span className="font-medium">{health.wsConnections}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

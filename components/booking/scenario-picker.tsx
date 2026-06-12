"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PRICING_SCENARIOS } from "@/lib/pricing-scenarios";

type ServiceLite = { id: string; name: string; slug: string };

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function ScenarioPicker({ services }: { services: ServiceLite[] }) {
  const router = useRouter();

  const onSelectService = (slug: string) => {
    router.push(`/book?service=${encodeURIComponent(slug)}`, { scroll: false });
  };
  const bySlug = React.useMemo(
    () => new Map(services.map((s) => [s.slug, s])),
    [services]
  );

  return (
    <Card className="mb-6 rounded-2xl border-neutral-200 bg-white">
      <Accordion type="single" collapsible>
        <AccordionItem value="picker" className="border-0">
          <AccordionTrigger className="px-6 py-4 text-left hover:no-underline">
            <div>
              <div className="text-base font-semibold">
                Not sure what you need?
              </div>
              <div className="mt-1 text-sm font-normal text-muted-foreground">
                Pick a scenario that matches your situation — we&apos;ll suggest the right services.
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-4">
              {PRICING_SCENARIOS.map((scenario) => {
                const matched = scenario.serviceSlugs
                  .map((slug) => bySlug.get(slug))
                  .filter((s): s is ServiceLite => Boolean(s));

                if (matched.length === 0) return null;

                return (
                  <div
                    key={scenario.key}
                    className="rounded-xl border border-neutral-200 bg-[#faf9f6] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{scenario.label}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {scenario.description}
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatCents(scenario.budgetMinCents)}–
                        {formatCents(scenario.budgetMaxCents)}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {matched.map((svc) => (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => onSelectService(svc.slug)}
                          className="focus-visible:ring-ring rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        >
                          <Badge
                            variant="outline"
                            className="cursor-pointer hover:border-neutral-400 hover:bg-neutral-50"
                          >
                            + {svc.name}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Each scenario shows realistic Atlanta-market budget ranges. Final
              price is set by your mechanic on-site after inspection.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";
import { Wrench, MapPin, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const SERVICE_AREAS = [
  {
    id: "mobile_mechanic",
    label: "Mobile Mechanic",
    description: "On-site repairs at the customer's location",
    category: "type" as const,
    popular: true,
  },
  {
    id: "atlanta_itp",
    label: "Atlanta ITP",
    description: "Inside the Perimeter — Midtown, Buckhead, Downtown, West End",
    category: "zone" as const,
  },
  {
    id: "atlanta_otp",
    label: "Atlanta OTP",
    description: "Outside the Perimeter — Sandy Springs, Dunwoody, Roswell",
    category: "zone" as const,
  },
  {
    id: "marietta_cobb",
    label: "Marietta / Cobb",
    description: "Marietta, Smyrna, Kennesaw, Acworth",
    category: "zone" as const,
  },
  {
    id: "decatur_dekalb",
    label: "Decatur / DeKalb",
    description: "Decatur, Stone Mountain, Lithonia, Tucker",
    category: "zone" as const,
  },
  {
    id: "gwinnett",
    label: "Gwinnett",
    description: "Lawrenceville, Duluth, Suwanee, Buford",
    category: "zone" as const,
  },
  {
    id: "south_fulton",
    label: "South Fulton",
    description: "College Park, East Point, Union City, Fairburn",
    category: "zone" as const,
  },
] as const;

function CheckIndicator({ checked }: { checked: boolean }) {
  return (
    <div
      className={cn(
        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs transition-colors",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background"
      )}
      aria-hidden
    >
      {checked && <Check className="h-3 w-3" />}
    </div>
  );
}

interface ServiceAreaPickerProps {
  selected: string[];
  onChange: (areas: string[]) => void;
  required?: boolean;
}

export function ServiceAreaPicker({ selected, onChange, required }: ServiceAreaPickerProps) {
  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  }

  const typeAreas = SERVICE_AREAS.filter((a) => a.category === "type");
  const zoneAreas = SERVICE_AREAS.filter((a) => a.category === "zone");

  return (
    <div className="space-y-3">
      {/* Service Type */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Service Type</p>
        {typeAreas.map((area) => {
          const isSelected = selected.includes(area.id);
          return (
            <button
              key={area.id}
              type="button"
              onClick={() => toggle(area.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
              )}
            >
              <CheckIndicator checked={isSelected} />
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">{area.label}</span>
                  {"popular" in area && area.popular && (
                    <Badge variant="secondary" className="text-xs">Popular</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{area.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Coverage Zones */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Coverage Zones{required && <span className="text-destructive"> *</span>}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {zoneAreas.map((area) => {
            const isSelected = selected.includes(area.id);
            return (
              <button
                key={area.id}
                type="button"
                onClick={() => toggle(area.id)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                )}
              >
                <CheckIndicator checked={isSelected} />
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{area.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{area.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

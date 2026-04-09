// server/api/lib/observation-upsell.ts

const OBSERVATION_TO_MECHANIC_SERVICE: Record<string, string> = {
  "Brakes": "brake-service",
  "Battery": "battery-replace",
  "Belts": "belt-replacement",
  "AC/Cooling": "ac-repair",
  "Engine": "general-maintenance",
  "Fluids": "oil-change",
};

interface ObservationItem {
  category: string;
  severity: string;
  description: string;
}

interface VehicleInfo {
  year?: string;
  make?: string;
  model?: string;
}

export interface UpsellLink {
  category: string;
  serviceSlug: string;
  deepLink: string;
}

export function getUpsellLinks(
  items: ObservationItem[],
  vehicleInfo: VehicleInfo | null,
  baseUrl: string,
): UpsellLink[] {
  const links: UpsellLink[] = [];

  for (const item of items) {
    if (item.severity !== "medium" && item.severity !== "high") continue;

    const serviceSlug = OBSERVATION_TO_MECHANIC_SERVICE[item.category];
    if (!serviceSlug) continue;

    const params = new URLSearchParams({ service: serviceSlug });
    if (vehicleInfo?.year) params.set("vehicleYear", vehicleInfo.year);
    if (vehicleInfo?.make) params.set("vehicleMake", vehicleInfo.make);
    if (vehicleInfo?.model) params.set("vehicleModel", vehicleInfo.model);

    links.push({
      category: item.category,
      serviceSlug,
      deepLink: `${baseUrl}/book?${params.toString()}`,
    });
  }

  return links;
}

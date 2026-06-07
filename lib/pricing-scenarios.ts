// Atlanta scenario budgets sourced from 2026 market research
// (docs/atlanta_vehicle_service_cost_deep_dive (1).md).
// Shared by /api/services/scenarios and the /book page picker.

export const PRICING_SCENARIOS = [
  {
    key: "light",
    label: "Light visit",
    description: "Oil change, basic inspection, OBD2 scan",
    budgetMinCents: 7500,
    budgetMaxCents: 23000,
    serviceSlugs: ["oil-change", "basic-inspection"],
  },
  {
    key: "routine",
    label: "Routine reconditioning",
    description: "Oil + diagnostic + 1-axle brakes + short tow + express detail",
    budgetMinCents: 55000,
    budgetMaxCents: 105000,
    serviceSlugs: ["oil-change", "mobile-diagnostic", "brake-service", "towing"],
  },
  {
    key: "moderate",
    label: "Moderate catch-up",
    description: "Above + battery + alignment + full interior/exterior detail",
    budgetMinCents: 100000,
    budgetMaxCents: 190000,
    serviceSlugs: ["oil-change", "brake-service", "battery-replace", "wheel-alignment"],
  },
  {
    key: "heavy",
    label: "Heavy retail repair",
    description: "Alternator or A/C + suspension + tow + detail",
    budgetMinCents: 140000,
    budgetMaxCents: 300000,
    serviceSlugs: ["alternator-replace", "ac-repair", "suspension-repair", "towing"],
  },
  {
    key: "dealer",
    label: "Dealer-path repair",
    description: "Dealer-rate labor + tow + premium detail",
    budgetMinCents: 200000,
    budgetMaxCents: 400000,
    serviceSlugs: ["tune-up", "transmission-service", "suspension-repair", "towing"],
  },
] as const;

export type PricingScenario = (typeof PRICING_SCENARIOS)[number];
export type PricingScenarioKey = PricingScenario["key"];

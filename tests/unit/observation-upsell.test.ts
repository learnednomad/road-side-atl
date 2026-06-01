import { describe, it, expect } from "vitest";
import { getUpsellLinks } from "@/server/api/lib/observation-upsell";

describe("getUpsellLinks", () => {
  const baseUrl = "https://roadsideatl.com";
  const vehicleInfo = { year: "2020", make: "Honda", model: "Civic" };

  it("returns upsell link for medium severity mapped category", () => {
    const items = [
      { category: "Brakes", severity: "medium", description: "Worn brake pads" },
    ];
    const links = getUpsellLinks(items, vehicleInfo, baseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].category).toBe("Brakes");
    expect(links[0].serviceSlug).toBe("brake-service");
    expect(links[0].deepLink).toBe(
      "https://roadsideatl.com/book?service=brake-service&vehicleYear=2020&vehicleMake=Honda&vehicleModel=Civic"
    );
  });

  it("returns upsell link for high severity mapped category", () => {
    const items = [
      { category: "Battery", severity: "high", description: "Battery dead" },
    ];
    const links = getUpsellLinks(items, vehicleInfo, baseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].serviceSlug).toBe("battery-replace");
  });

  it("excludes low severity items regardless of category", () => {
    const items = [
      { category: "Brakes", severity: "low", description: "Minor wear" },
    ];
    const links = getUpsellLinks(items, vehicleInfo, baseUrl);
    expect(links).toHaveLength(0);
  });

  it("excludes unmapped categories regardless of severity", () => {
    const items = [
      { category: "Cosmetic", severity: "high", description: "Scratch on bumper" },
    ];
    const links = getUpsellLinks(items, vehicleInfo, baseUrl);
    expect(links).toHaveLength(0);
  });

  it("handles multiple items with mixed severities and categories", () => {
    const items = [
      { category: "Brakes", severity: "medium", description: "Worn pads" },
      { category: "Battery", severity: "low", description: "Slightly low" },
      { category: "AC/Cooling", severity: "high", description: "AC not working" },
      { category: "Cosmetic", severity: "high", description: "Dent" },
      { category: "Engine", severity: "medium", description: "Check engine light" },
    ];
    const links = getUpsellLinks(items, vehicleInfo, baseUrl);
    expect(links).toHaveLength(3); // Brakes (medium), AC/Cooling (high), Engine (medium)
    expect(links.map((l) => l.serviceSlug)).toEqual([
      "brake-service",
      "ac-repair",
      "general-maintenance",
    ]);
  });

  it("handles null vehicleInfo gracefully", () => {
    const items = [
      { category: "Brakes", severity: "medium", description: "Worn pads" },
    ];
    const links = getUpsellLinks(items, null, baseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].deepLink).toBe(
      "https://roadsideatl.com/book?service=brake-service"
    );
  });

  it("handles partial vehicleInfo (missing model)", () => {
    const items = [
      { category: "Fluids", severity: "high", description: "Low oil" },
    ];
    const links = getUpsellLinks(items, { year: "2019", make: "Toyota" }, baseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].deepLink).toBe(
      "https://roadsideatl.com/book?service=oil-change&vehicleYear=2019&vehicleMake=Toyota"
    );
  });

  it("returns empty array when all items are low severity", () => {
    const items = [
      { category: "Brakes", severity: "low", description: "Fine" },
      { category: "Battery", severity: "low", description: "OK" },
    ];
    const links = getUpsellLinks(items, vehicleInfo, baseUrl);
    expect(links).toHaveLength(0);
  });

  it("returns empty array for empty items array", () => {
    const links = getUpsellLinks([], vehicleInfo, baseUrl);
    expect(links).toHaveLength(0);
  });

  it("maps all known categories correctly", () => {
    const categories = [
      { category: "Brakes", expectedSlug: "brake-service" },
      { category: "Battery", expectedSlug: "battery-replace" },
      { category: "Belts", expectedSlug: "belt-replacement" },
      { category: "AC/Cooling", expectedSlug: "ac-repair" },
      { category: "Engine", expectedSlug: "general-maintenance" },
      { category: "Fluids", expectedSlug: "oil-change" },
    ];

    for (const { category, expectedSlug } of categories) {
      const links = getUpsellLinks(
        [{ category, severity: "high", description: "Issue" }],
        null,
        baseUrl
      );
      expect(links).toHaveLength(1);
      expect(links[0].serviceSlug).toBe(expectedSlug);
    }
  });
});

import { db } from "@/db";
import { timeBlockConfigs, services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_MULTIPLIER_BP } from "@/lib/constants";

export async function calculateBookingPrice(
  serviceId: string,
  scheduledAt?: Date | null,
): Promise<{
  basePrice: number; // cents
  multiplier: number; // basis points
  blockName: string;
  finalPrice: number; // cents
}> {
  const service = await db.query.services.findFirst({
    where: eq(services.id, serviceId),
  });
  // Callers must validate serviceId exists before calling this function.
  // Throws produce Hono 500 -- this is intentional as a programming error guard.
  if (!service) throw new Error("Service not found");

  const pricingDate = scheduledAt ?? new Date();
  const hour = pricingDate.getHours();

  const configs = await db.query.timeBlockConfigs.findMany({
    where: eq(timeBlockConfigs.isActive, true),
  });

  // Find matching block (highest priority wins)
  // Handle overnight blocks where startHour > endHour (e.g., 18-6)
  const matching = configs
    .filter((c) => {
      if (c.startHour <= c.endHour) {
        return hour >= c.startHour && hour < c.endHour;
      }
      // Overnight: e.g., 18-6 means 18-23 OR 0-5
      return hour >= c.startHour || hour < c.endHour;
    })
    .sort((a, b) => b.priority - a.priority);

  const block = matching[0];
  const multiplier = block?.multiplier ?? DEFAULT_MULTIPLIER_BP;
  const blockName = block?.name ?? "Standard";

  const finalPrice = Math.round((service.basePrice * multiplier) / 10000);

  return { basePrice: service.basePrice, multiplier, blockName, finalPrice };
}

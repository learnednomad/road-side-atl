import { calculateDistance } from "@/lib/distance";
import { AVERAGE_DRIVING_SPEED_MPH } from "@/lib/constants";

export function calculateEtaMinutes(
  providerLat: number,
  providerLng: number,
  destLat: number,
  destLng: number
): number {
  const distanceMiles = calculateDistance(
    { latitude: providerLat, longitude: providerLng },
    { latitude: destLat, longitude: destLng }
  );
  const hours = distanceMiles / AVERAGE_DRIVING_SPEED_MPH;
  return Math.max(1, Math.round(hours * 60));
}

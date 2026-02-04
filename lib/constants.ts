export const BUSINESS = {
  name: process.env.NEXT_PUBLIC_BUSINESS_NAME || "RoadSide ATL",
  phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE || "(404) 555-0199",
  cashAppTag: process.env.NEXT_PUBLIC_CASHAPP_TAG || "$RoadsideATL",
  zelleInfo: process.env.NEXT_PUBLIC_ZELLE_INFO || "pay@roadsideatl.com",
  serviceArea: "Atlanta Metro Area (ITP & OTP)",
  tagline: "Atlanta's Premium Roadside Assistance",
} as const;

export const SERVICE_CATEGORIES = ["roadside", "diagnostics"] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "dispatched",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_METHODS = ["cash", "cashapp", "zelle", "stripe"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  "pending",
  "confirmed",
  "failed",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const USER_ROLES = ["customer", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const TOWING_BASE_MILES = 10;
export const TOWING_PRICE_PER_MILE_CENTS = 600; // $6/mile

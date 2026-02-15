export const BUSINESS = {
  name: process.env.NEXT_PUBLIC_BUSINESS_NAME || "RoadSide ATL",
  phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE || "(404) 555-0199",
  email: "support@roadsideatl.com",
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

export const USER_ROLES = ["customer", "admin", "provider"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROVIDER_STATUSES = ["active", "inactive", "pending"] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const COMMISSION_TYPES = ["percentage", "flat_per_job"] as const;
export type CommissionType = (typeof COMMISSION_TYPES)[number];

export const PAYOUT_STATUSES = ["pending", "paid"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const INVOICE_STATUSES = ["draft", "issued", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const TOWING_BASE_MILES = 10;
export const TOWING_PRICE_PER_MILE_CENTS = 600; // $6/mile

export const TRUST_TIER_LEVELS = [1, 2] as const;
export type TrustTier = (typeof TRUST_TIER_LEVELS)[number];
export const TRUST_TIER_PROMOTION_THRESHOLD = 3; // clean transactions to reach Tier 2

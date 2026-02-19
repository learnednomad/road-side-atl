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

export const PROVIDER_STATUSES = ["active", "inactive", "pending", "resubmission_requested"] as const;
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

export const TIER_1_ALLOWED_METHODS = ["cash", "cashapp", "zelle"] as const;
export const TIER_2_ALLOWED_METHODS = ["cash", "cashapp", "zelle", "stripe"] as const;

export const OBSERVATION_SEVERITIES = ["low", "medium", "high"] as const;
export type ObservationSeverity = (typeof OBSERVATION_SEVERITIES)[number];

export const REFERRAL_STATUSES = ["pending", "credited", "expired"] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];
export const REFERRAL_CREDIT_AMOUNT_CENTS = 1000; // $10.00
export const REFERRAL_SMS_DELAY_MINUTES = 30;

export const INSPECTION_CONDITIONS = ["good", "fair", "poor", "critical"] as const;
export type InspectionCondition = (typeof INSPECTION_CONDITIONS)[number];

export const DEFAULT_DISPATCH_RADIUS_MILES = 50;
export const EXPANDED_DISPATCH_RADIUS_MILES = 100;

export const DEFAULT_MULTIPLIER_BP = 10000; // 1.0x in basis points

export const STORM_MODE_PRIORITY = 100; // Storm templates have priority >= this value

export const DEFAULT_COMMISSION_RATE_BP = 2500; // 25% platform commission (default for roadside)
export const COMMISSION_RATE_DIAGNOSTICS_BP = 2000; // 20% platform commission (diagnostics)

export const AVERAGE_DRIVING_SPEED_MPH = 35;
export const ETA_DELAY_THRESHOLD_MINUTES = 15;

export const IRS_1099_THRESHOLD_CENTS = 60000; // $600 IRS 1099-NEC reporting threshold

export const B2B_ACCOUNT_STATUSES = ["pending", "active", "suspended"] as const;
export type B2bAccountStatus = (typeof B2B_ACCOUNT_STATUSES)[number];

export const B2B_PAYMENT_TERMS = ["prepaid", "net_30", "net_60"] as const;
export type B2bPaymentTerms = (typeof B2B_PAYMENT_TERMS)[number];

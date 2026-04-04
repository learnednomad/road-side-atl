export const BUSINESS = {
  name: process.env.NEXT_PUBLIC_BUSINESS_NAME || "RoadSide GA",
  phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE || "(404) 555-0199",
  email: "support@roadsidega.com",
  cashAppTag: process.env.NEXT_PUBLIC_CASHAPP_TAG || "$RoadsideGA",
  zelleInfo: process.env.NEXT_PUBLIC_ZELLE_INFO || "pay@roadsidega.com",
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
  "disputed",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const USER_ROLES = ["customer", "admin", "provider"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROVIDER_STATUSES = [
  "active", "inactive", "pending", "resubmission_requested",
  "applied", "onboarding", "pending_review", "rejected", "suspended",
] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const PROVIDER_ONBOARDING_STATUSES = ["applied", "onboarding", "pending_review", "rejected", "suspended"] as const;
export type ProviderOnboardingStatus = (typeof PROVIDER_ONBOARDING_STATUSES)[number];

export const COMMISSION_TYPES = ["percentage", "flat_per_job"] as const;
export type CommissionType = (typeof COMMISSION_TYPES)[number];

export const PAYOUT_STATUSES = ["pending", "paid"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const INVOICE_STATUSES = ["draft", "issued", "paid", "void", "overdue"] as const;
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

export const B2B_INVOICE_DUE_DAYS: Record<B2bPaymentTerms, number> = {
  prepaid: 0,
  net_30: 30,
  net_60: 60,
};

export const ONBOARDING_STEP_TYPES = [
  "background_check", "insurance", "certifications", "training", "stripe_connect",
] as const;
export type OnboardingStepType = (typeof ONBOARDING_STEP_TYPES)[number];

export const ONBOARDING_STEP_STATUSES = [
  "pending", "draft", "in_progress", "pending_review", "complete", "rejected", "blocked",
] as const;
export type OnboardingStepStatus = (typeof ONBOARDING_STEP_STATUSES)[number];

export const DOCUMENT_TYPES = ["insurance", "certification", "vehicle_doc"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = ["pending_review", "approved", "rejected"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const TRAINING_TOPICS = [
  "dispatch_protocol",
  "safety_procedures",
  "cancellation_policy",
  "payment_terms",
  "service_area",
  "platform_terms",
] as const;
export type TrainingTopic = (typeof TRAINING_TOPICS)[number];

export const ONBOARDING_INVITE_EXPIRY_HOURS = 72;

export const REAPPLY_COOLDOWN_DAYS = 30;

// Auth constants
export const NEXTAUTH_JWT_SALT = "authjs.session-token";

// Document upload constants
export const PRESIGNED_UPLOAD_EXPIRY = 900; // 15 minutes (NFR-S2)
export const PRESIGNED_DOWNLOAD_EXPIRY_ADMIN = 600; // 10 minutes (NFR-S3)
export const PRESIGNED_DOWNLOAD_EXPIRY_PROVIDER = 3600; // 1 hour
export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB raw
export const ALLOWED_DOCUMENT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type AllowedDocumentImageType = (typeof ALLOWED_DOCUMENT_IMAGE_TYPES)[number];
export const MIN_DOCUMENTS_PER_STEP: Record<string, number> = {
  insurance: 1,
  certifications: 1,
  vehicle_doc: 0,
};

// Checkr background check constants
export const CHECKR_PACKAGE = "tasker_standard";
export const CHECKR_POLLING_THRESHOLD_HOURS = 24;
export const CHECKR_MAX_RETRIES = 3;

// Checkr status → onboarding step status mapping
// Used by webhook handler and reconciliation polling
// Note: adjudication overrides status when present — "engaged"/"pre_adverse_action" stay in_progress
// Checkr Dashboard URL for admin report viewing
export const CHECKR_DASHBOARD_BASE_URL = "https://dashboard.checkr.com/reports";

// Stripe Connect migration — set when migration goes live; null = not yet launched
export const MIGRATION_LAUNCH_DATE: Date | null = (() => {
  if (!process.env.MIGRATION_LAUNCH_DATE) return null;
  const d = new Date(process.env.MIGRATION_LAUNCH_DATE);
  if (isNaN(d.getTime())) {
    console.error(`[Constants] Invalid MIGRATION_LAUNCH_DATE: "${process.env.MIGRATION_LAUNCH_DATE}"`);
    return null;
  }
  return d;
})();

export const MIGRATION_DEPRECATION_DAYS = 60;
export const MIGRATION_GRACE_PERIOD_DAYS = 30;

export const CHECKR_STATUS_MAP: Record<string, string> = {
  clear: "complete",
  consider: "pending_review",
  suspended: "rejected",
  adverse_action: "rejected",
  post_adverse_action: "rejected",
};

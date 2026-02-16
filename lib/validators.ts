import { z } from "zod/v4";

export const vehicleInfoSchema = z.object({
  year: z.string().min(4, "Year is required"),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  color: z.string().min(1, "Color is required"),
});

export const locationSchema = z.object({
  address: z.string().min(5, "Address is required"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  placeId: z.string().optional(),
  notes: z.string().optional(),
  destination: z.string().optional(),
  destinationLatitude: z.number().optional(),
  destinationLongitude: z.number().optional(),
  estimatedMiles: z.number().min(0).optional(),
});

export const createBookingSchema = z.object({
  serviceId: z.string().uuid("Invalid service"),
  vehicleInfo: vehicleInfoSchema,
  location: locationSchema,
  contactName: z.string().min(2, "Name is required"),
  contactPhone: z.string().min(10, "Phone number is required"),
  contactEmail: z.email("Valid email is required"),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  paymentMethod: z.enum(["cash", "cashapp", "zelle", "stripe"]).optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum([
    "pending",
    "confirmed",
    "dispatched",
    "in_progress",
    "completed",
    "cancelled",
  ]),
});

export const confirmPaymentSchema = z.object({
  method: z.enum(["cash", "cashapp", "zelle"]),
  amount: z.number().int().positive().optional(),
});

export const createStripeCheckoutSchema = z.object({
  bookingId: z.string().uuid("Invalid booking"),
});

export const createProviderSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email("Valid email is required"),
  phone: z.string().min(10, "Phone number is required"),
  commissionType: z.enum(["percentage", "flat_per_job"]),
  commissionRate: z.number().int().min(0).max(10000), // basis points
  flatFeeAmount: z.number().int().min(0).optional(),
  specialties: z.array(z.string()).optional(),
  status: z.enum(["active", "inactive", "pending"]).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  address: z.string().optional(),
});

export const updateProviderSchema = createProviderSchema.partial();

export const assignProviderSchema = z.object({
  providerId: z.string().uuid("Invalid provider"),
});

export const markPayoutPaidSchema = z.object({
  payoutIds: z.array(z.string().uuid()),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export const providerInviteSchema = z.object({
  email: z.email("Valid email is required"),
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(10, "Phone number is required"),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(10, "Phone number is required"),
});

export const providerSelfRegisterSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email("Valid email is required"),
  phone: z.string().min(10, "Phone number is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  specialties: z.array(z.string()).optional(),
  address: z.string().optional(),
});

export const generateInvoiceSchema = z.object({
  bookingId: z.string().uuid("Invalid booking"),
});

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(["issued", "void"]),
});

export const createStandaloneInvoiceSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerEmail: z.email("Valid email is required"),
  customerPhone: z.string().min(10, "Phone number is required"),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1, "Description is required"),
        quantity: z.number().int().positive("Quantity must be positive"),
        unitPrice: z.number().int().positive("Unit price must be positive"),
      })
    )
    .min(1, "At least one line item is required"),
  notes: z.string().optional(),
});

export const trustTierUpdateSchema = z.object({
  trustTier: z.number().int().min(1).max(2),
});

export type TrustTierUpdateInput = z.infer<typeof trustTierUpdateSchema>;

export function isPaymentMethodAllowedForTier(method: string, trustTier: number): boolean {
  if (method === "stripe" && trustTier < 2) return false;
  return true;
}

export const updatePromotionThresholdSchema = z.object({
  promotionThreshold: z.number().int().min(1).max(100),
});

export type UpdatePromotionThresholdInput = z.infer<typeof updatePromotionThresholdSchema>;

export const createObservationSchema = z.object({
  bookingId: z.string().uuid("Invalid booking"),
  items: z
    .array(
      z.object({
        category: z.string().min(1, "Category is required"),
        description: z.string().min(1, "Description is required"),
        severity: z.enum(["low", "medium", "high"]),
        photoUrl: z.string().url().optional(),
      })
    )
    .min(1, "At least one observation item is required"),
});

export type CreateObservationInput = z.infer<typeof createObservationSchema>;

export const createReferralSchema = z.object({
  referralCode: z.string().min(1, "Referral code is required"),
});

export type CreateReferralInput = z.infer<typeof createReferralSchema>;

export const redeemCreditsSchema = z.object({
  bookingId: z.string().min(1),
  amount: z.number().int().positive(),
});
export type RedeemCreditsInput = z.infer<typeof redeemCreditsSchema>;

export const providerReferralSchema = z.object({
  refereeEmail: z.email("Valid email is required"),
  refereeName: z.string().min(1, "Name is required"),
  refereePhone: z.string().optional(),
});
export type ProviderReferralInput = z.infer<typeof providerReferralSchema>;

export const createInspectionReportSchema = z.object({
  bookingId: z.string().uuid("Invalid booking"),
  findings: z
    .array(
      z.object({
        category: z.string().min(1, "Category is required"),
        component: z.string().min(1, "Component is required"),
        condition: z.enum(["good", "fair", "poor", "critical"]),
        description: z.string().min(1, "Description is required"),
        measurement: z.string().optional(),
        photoUrl: z.string().url().optional(),
        obdCode: z.string().optional(),
      })
    )
    .min(1, "At least one finding is required"),
});

export type CreateInspectionReportInput = z.infer<typeof createInspectionReportSchema>;

export const updateChecklistConfigSchema = z.object({
  checklistConfig: z.array(
    z.object({
      category: z.string().min(1),
      items: z.array(z.string().min(1)).min(1),
    })
  ),
});

export type UpdateChecklistConfigInput = z.infer<typeof updateChecklistConfigSchema>;

export const createTimeBlockConfigSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(0).max(24), // 24 allowed for all-day blocks (0-24)
  multiplier: z.number().int().min(1).max(50000), // basis points: 10000 = 1.0x
  isActive: z.boolean().optional(),
  priority: z.number().int().min(1).max(100).optional(),
});

export type CreateTimeBlockConfigInput = z.infer<typeof createTimeBlockConfigSchema>;

export const updateTimeBlockConfigSchema = createTimeBlockConfigSchema.partial();

export type UpdateTimeBlockConfigInput = z.infer<typeof updateTimeBlockConfigSchema>;

export const activateStormModeSchema = z.object({
  templateId: z.string().uuid("Invalid template ID"),
});
export type ActivateStormModeInput = z.infer<typeof activateStormModeSchema>;

export const overrideBookingPriceSchema = z.object({
  priceOverrideCents: z.number().int().positive("Override price must be positive"),
  reason: z.string().min(1, "Override reason is required"),
});
export type OverrideBookingPriceInput = z.infer<typeof overrideBookingPriceSchema>;

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type VehicleInfo = z.infer<typeof vehicleInfoSchema>;
export type LocationInfo = z.infer<typeof locationSchema>;

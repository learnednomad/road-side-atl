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

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type VehicleInfo = z.infer<typeof vehicleInfoSchema>;
export type LocationInfo = z.infer<typeof locationSchema>;

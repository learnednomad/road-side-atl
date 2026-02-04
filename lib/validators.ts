import { z } from "zod/v4";

export const vehicleInfoSchema = z.object({
  year: z.string().min(4, "Year is required"),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  color: z.string().min(1, "Color is required"),
});

export const locationSchema = z.object({
  address: z.string().min(5, "Address is required"),
  notes: z.string().optional(),
  destination: z.string().optional(),
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

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type VehicleInfo = z.infer<typeof vehicleInfoSchema>;
export type LocationInfo = z.infer<typeof locationSchema>;

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

// Invoice schemas
export const invoiceLineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  details: z.string().optional(),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().int().min(0, "Unit price must be >= 0"), // cents
});

export const createInvoiceSchema = z.object({
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerPhone: z.string().optional(),
  customerCompany: z.string().optional(),
  customerAddress: z.string().optional(),
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  lineItems: z.array(invoiceLineItemSchema).min(1, "At least one line item is required"),
  taxRate: z.number().int().min(0).max(10000).optional(), // basis points
  paymentTerms: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentInstructions: z.string().optional(),
  notes: z.string().optional(),
  saveCustomer: z.boolean().optional(),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export const businessSettingsSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  companyAddress: z.string().optional(),
  companyPhone: z.string().optional(),
  companyEmail: z.string().email().optional().or(z.literal("")),
  logoUrl: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankRoutingNumber: z.string().optional(),
  bankSwiftCode: z.string().optional(),
  defaultPaymentTerms: z.string().optional(),
  defaultPaymentMethod: z.string().optional(),
  defaultPaymentInstructions: z.string().optional(),
  invoicePrefix: z.string().optional(),
  defaultTaxRate: z.number().int().min(0).max(10000).optional(),
  invoiceFooterNote: z.string().optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type VehicleInfo = z.infer<typeof vehicleInfoSchema>;
export type LocationInfo = z.infer<typeof locationSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type BusinessSettingsInput = z.infer<typeof businessSettingsSchema>;

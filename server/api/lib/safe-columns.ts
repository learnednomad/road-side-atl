import { users } from "@/db/schema";

/**
 * Whitelist of user columns safe to return in API responses. Deliberately omits
 * `password` (bcrypt hash), `taxId` (encrypted PII), `stripeCustomerId`, and
 * `defaultPaymentMethodId` — these must never leave the server, even to admins.
 *
 * Use this instead of `select({ user: users })`, which ships every column.
 */
export const safeUserColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  emailVerified: users.emailVerified,
  image: users.image,
  phone: users.phone,
  role: users.role,
  tenantId: users.tenantId,
  trustTier: users.trustTier,
  cleanTransactionCount: users.cleanTransactionCount,
  referralCode: users.referralCode,
  trustTierUpdatedAt: users.trustTierUpdatedAt,
  trustTierReason: users.trustTierReason,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;

import { Hono } from "hono";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { providers } from "@/db/schema/providers";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  acceptInviteSchema,
  providerSelfRegisterSchema,
} from "@/lib/validators";
import { rateLimitAuth } from "../middleware/rate-limit";
import { logAudit, getRequestInfo } from "../lib/audit-logger";
import {
  verifyInviteToken,
  acceptProviderInvite,
} from "@/lib/auth/provider-invite";
import { sendVerificationEmail } from "@/lib/auth/verification";

const app = new Hono();

// Rate limit all public endpoints
app.use("/*", rateLimitAuth);

// Verify invite token — returns provider data for pre-filling form
app.post("/verify-invite", async (c) => {
  const body = await c.req.json();
  const { token } = body;

  if (!token || typeof token !== "string") {
    return c.json({ error: "Token is required" }, 400);
  }

  const result = await verifyInviteToken(token);

  if (!result.valid) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({
    valid: true,
    providerData: result.providerData,
  });
});

// Accept invite — creates user account and links to provider
app.post("/accept-invite", async (c) => {
  const body = await c.req.json();
  const parsed = acceptInviteSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid input", details: parsed.error.issues },
      400
    );
  }

  const { token, password, name, phone } = parsed.data;

  const result = await acceptProviderInvite(token, password, name, phone);

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "provider.invite_accepted",
    userId: result.userId,
    resourceType: "user",
    resourceId: result.userId,
    details: { method: "invite" },
    ipAddress,
    userAgent,
  });

  return c.json({
    success: true,
    message: "Account created successfully. You can now log in.",
  });
});

// Self-registration — creates pending provider + unverified user
app.post("/register", async (c) => {
  const body = await c.req.json();
  const parsed = providerSelfRegisterSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0].message },
      400
    );
  }

  const { name, email, phone, password, specialties, address } = parsed.data;

  // Check if user with email already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    return c.json(
      { error: "An account with this email already exists" },
      409
    );
  }

  // Check if provider with email already exists
  const existingProvider = await db.query.providers.findFirst({
    where: eq(providers.email, email),
  });

  if (existingProvider) {
    return c.json(
      { error: "A provider with this email already exists" },
      409
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user with provider role (email NOT verified)
  const [newUser] = await db
    .insert(users)
    .values({
      name,
      email,
      phone,
      password: hashedPassword,
      role: "provider",
    })
    .returning({ id: users.id });

  // Create provider record with pending status
  await db.insert(providers).values({
    userId: newUser.id,
    name,
    email,
    phone,
    specialties: specialties ?? [],
    address: address ?? null,
    status: "pending",
  });

  // Send verification email
  sendVerificationEmail(email, name).catch((err) => {
    console.error("Failed to send verification email:", err);
  });

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "provider.self_register",
    userId: newUser.id,
    resourceType: "user",
    resourceId: newUser.id,
    details: { email, method: "self_registration" },
    ipAddress,
    userAgent,
  });

  return c.json({
    success: true,
    message:
      "Registration submitted. Please check your email to verify your account. An admin will review your application.",
  });
});

export default app;

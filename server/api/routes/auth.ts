import { Hono } from "hono";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { encode } from "next-auth/jwt";
import { registerSchema, loginSchema } from "@/lib/validators";
import { NEXTAUTH_JWT_SALT } from "@/lib/constants";
import { rateLimitAuth } from "../middleware/rate-limit";
import { logAudit, getRequestInfo } from "../lib/audit-logger";
import { generateReferralCode } from "../lib/referral-credits";
import {
  sendVerificationEmail,
  verifyEmailToken,
  sendPasswordResetEmail,
  verifyPasswordResetToken,
  consumePasswordResetToken,
} from "@/lib/auth/verification";

const app = new Hono();

// Apply strict rate limiting to auth endpoints
app.use("/register", rateLimitAuth);
app.use("/forgot-password", rateLimitAuth);
app.use("/reset-password", rateLimitAuth);
app.use("/resend-verification", rateLimitAuth);
app.use("/mobile-login", rateLimitAuth);

// Register new user
app.post("/register", async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  const { name, email, password } = parsed.data;

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) {
    return c.json({ error: "An account with this email already exists" }, 409);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const referralCode = await generateReferralCode();
  const [newUser] = await db.insert(users).values({
    name,
    email,
    password: hashedPassword,
    referralCode,
  }).returning({ id: users.id });

  // Send verification email (fire and forget)
  sendVerificationEmail(email, name).catch((err) => {
    console.error("Failed to send verification email:", err);
  });

  // Audit log the registration
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "user.register",
    userId: newUser.id,
    resourceType: "user",
    resourceId: newUser.id,
    details: { email },
    ipAddress,
    userAgent,
  });

  return c.json({ success: true, message: "Please check your email to verify your account" });
});

// Verify email
app.post("/verify-email", async (c) => {
  const body = await c.req.json();
  const { token } = body;

  if (!token || typeof token !== "string") {
    return c.json({ error: "Invalid token" }, 400);
  }

  const result = await verifyEmailToken(token);

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ success: true, email: result.email });
});

// Resend verification email
app.post("/resend-verification", async (c) => {
  const body = await c.req.json();
  const { email } = body;

  if (!email || typeof email !== "string") {
    return c.json({ error: "Email is required" }, 400);
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    // Don't reveal if user exists
    return c.json({ success: true });
  }

  if (user.emailVerified) {
    return c.json({ error: "Email is already verified" }, 400);
  }

  await sendVerificationEmail(email, user.name || "");

  return c.json({ success: true });
});

// Forgot password - send reset email
app.post("/forgot-password", async (c) => {
  const body = await c.req.json();
  const { email } = body;

  if (!email || typeof email !== "string") {
    return c.json({ error: "Email is required" }, 400);
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return c.json({ success: true });
  }

  await sendPasswordResetEmail(email, user.name || "");

  return c.json({ success: true });
});

// Verify reset token (check if valid before showing reset form)
app.post("/verify-reset-token", async (c) => {
  const body = await c.req.json();
  const { token } = body;

  if (!token || typeof token !== "string") {
    return c.json({ valid: false }, 400);
  }

  const result = await verifyPasswordResetToken(token);

  return c.json({ valid: result.valid });
});

// Reset password
app.post("/reset-password", async (c) => {
  const body = await c.req.json();
  const { token, password } = body;

  if (!token || typeof token !== "string") {
    return c.json({ error: "Invalid token" }, 400);
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  const email = await consumePasswordResetToken(token);

  if (!email) {
    return c.json({ error: "Invalid or expired reset link" }, 400);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await db
    .update(users)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(users.email, email));

  return c.json({ success: true });
});

// Mobile login - returns JWT token directly (no cookie extraction needed)
app.post("/mobile-login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid email or password" }, 400);
  }

  const { email, password } = parsed.data;

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user?.password) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Check if email is verified (skip for admin accounts)
  if (!user.emailVerified && user.role !== "admin") {
    return c.json({ error: "Please verify your email before signing in" }, 403);
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return c.json({ error: "Server configuration error" }, 500);
  }

  // Generate a NextAuth-compatible JWT token
  const token = await encode({
    token: {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      id: user.id,
    },
    secret,
    salt: NEXTAUTH_JWT_SALT,
    maxAge: 24 * 60 * 60, // 24 hours
  });

  // Audit log
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "user.mobile_login",
    userId: user.id,
    resourceType: "user",
    resourceId: user.id,
    details: { email, platform: "mobile" },
    ipAddress,
    userAgent,
  });

  return c.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// Mobile token refresh - exchange a valid token for a fresh one
app.post("/mobile-refresh", async (c) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const currentToken = authHeader.slice(7);
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return c.json({ error: "Server configuration error" }, 500);
  }

  try {
    const { decode } = await import("next-auth/jwt");
    const decoded = await decode({ token: currentToken, secret, salt: "authjs.session-token" });
    if (!decoded?.sub) {
      return c.json({ error: "Invalid token" }, 401);
    }

    // Verify user still exists and is active
    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.sub),
      columns: { id: true, name: true, email: true, role: true },
    });
    if (!user) {
      return c.json({ error: "User not found" }, 401);
    }

    // Issue fresh token
    const newToken = await encode({
      token: {
        sub: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        id: user.id,
      },
      secret,
      salt: NEXTAUTH_JWT_SALT,
      maxAge: 24 * 60 * 60,
    });

    return c.json({
      token: newToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
});

export default app;

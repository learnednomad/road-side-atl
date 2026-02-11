import { db } from "@/db";
import { providerInviteTokens } from "@/db/schema/auth";
import { users } from "@/db/schema/users";
import { providers } from "@/db/schema/providers";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/notifications/email";

const INVITE_TOKEN_EXPIRY = 72 * 60 * 60 * 1000; // 72 hours

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createProviderInviteToken(
  email: string,
  providerId: string,
  invitedBy: string
): Promise<string> {
  const token = generateToken();
  const expires = new Date(Date.now() + INVITE_TOKEN_EXPIRY);

  // Delete any existing pending tokens for this email
  await db
    .delete(providerInviteTokens)
    .where(
      and(
        eq(providerInviteTokens.identifier, email),
        eq(providerInviteTokens.status, "pending")
      )
    );

  await db.insert(providerInviteTokens).values({
    identifier: email,
    token,
    providerId,
    invitedBy,
    status: "pending",
    expires,
  });

  return token;
}

export async function verifyInviteToken(
  token: string
): Promise<{
  valid: boolean;
  email?: string;
  providerId?: string;
  providerData?: { name: string; email: string; phone: string };
  error?: string;
}> {
  const record = await db.query.providerInviteTokens.findFirst({
    where: eq(providerInviteTokens.token, token),
  });

  if (!record) {
    return { valid: false, error: "Invalid invite link" };
  }

  if (record.status === "accepted") {
    return { valid: false, error: "This invite has already been used" };
  }

  if (new Date() > record.expires) {
    await db
      .update(providerInviteTokens)
      .set({ status: "expired" })
      .where(eq(providerInviteTokens.token, token));
    return { valid: false, error: "This invite link has expired" };
  }

  // Fetch provider data for pre-filling the form
  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, record.providerId),
  });

  return {
    valid: true,
    email: record.identifier,
    providerId: record.providerId,
    providerData: provider
      ? { name: provider.name, email: provider.email, phone: provider.phone }
      : undefined,
  };
}

export async function acceptProviderInvite(
  token: string,
  password: string,
  name: string,
  phone: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  const verification = await verifyInviteToken(token);
  if (!verification.valid || !verification.email || !verification.providerId) {
    return { success: false, error: verification.error || "Invalid token" };
  }

  // Check if user with this email already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, verification.email),
  });

  if (existingUser) {
    return {
      success: false,
      error: "An account with this email already exists",
    };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user account with provider role and auto-verified email
  const [newUser] = await db
    .insert(users)
    .values({
      name,
      email: verification.email,
      phone,
      password: hashedPassword,
      role: "provider",
      emailVerified: new Date(),
    })
    .returning({ id: users.id });

  // Link user to provider record and activate
  await db
    .update(providers)
    .set({
      userId: newUser.id,
      name,
      phone,
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(providers.id, verification.providerId));

  // Mark invite as accepted
  await db
    .update(providerInviteTokens)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(providerInviteTokens.token, token));

  return { success: true, userId: newUser.id };
}

export async function sendProviderInviteEmail(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const baseUrl =
    process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const inviteUrl = `${baseUrl}/register/provider/invite?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #18181b; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9f9f9; }
        .button { display: inline-block; background: #18181b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>RoadSide ATL</h1>
        </div>
        <div class="content">
          <h2>You're Invited!</h2>
          <p>Hi ${name || "there"},</p>
          <p>You've been invited to join RoadSide ATL as a service provider. Click the button below to set up your account:</p>
          <p style="text-align: center;">
            <a href="${inviteUrl}" class="button">Complete Registration</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; font-size: 14px; color: #666;">${inviteUrl}</p>
          <p>This link will expire in 72 hours.</p>
          <p>If you weren't expecting this invitation, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} RoadSide ATL. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "You're invited to join RoadSide ATL as a provider",
    html,
  });
}

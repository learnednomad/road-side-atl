import { db } from "@/db";
import { providerInviteTokens } from "@/db/schema/auth";
import { users } from "@/db/schema/users";
import { providers } from "@/db/schema/providers";
import { onboardingSteps } from "@/db/schema/onboarding-steps";
import { createId } from "@/db/schema/utils";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/notifications/email";
import {
  INVITE_TOKEN_EXPIRY_MS,
  BETA_INVITE_TOKEN_EXPIRY_MS,
  ONBOARDING_STEP_TYPES,
  COMMISSION_RATE_MECHANICS_BP,
} from "@/lib/constants";

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createProviderInviteToken(
  email: string,
  invitedBy: string,
  options: {
    providerId?: string;
    inviteType?: "admin" | "beta" | "referral";
    name?: string;
    referringProviderId?: string;
  } = {}
): Promise<string> {
  const token = generateToken();
  const inviteType = options.inviteType ?? "admin";
  const expiryMs =
    inviteType === "beta" ? BETA_INVITE_TOKEN_EXPIRY_MS : INVITE_TOKEN_EXPIRY_MS;
  const expires = new Date(Date.now() + expiryMs);

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
    providerId: options.providerId,
    invitedBy,
    inviteType,
    name: options.name,
    referringProviderId: options.referringProviderId,
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
  inviteType?: "admin" | "beta" | "referral";
  referringProviderId?: string;
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

  // Fetch provider data for pre-filling the form (only for admin invites with a pre-existing provider)
  let providerData: { name: string; email: string; phone: string } | undefined;
  if (record.providerId) {
    const provider = await db.query.providers.findFirst({
      where: eq(providers.id, record.providerId),
    });
    if (provider) {
      providerData = {
        name: provider.name,
        email: provider.email,
        phone: provider.phone,
      };
    }
  }

  return {
    valid: true,
    email: record.identifier,
    providerId: record.providerId ?? undefined,
    inviteType: record.inviteType,
    referringProviderId: record.referringProviderId ?? undefined,
    providerData,
  };
}

export async function acceptProviderInvite(
  token: string,
  password: string,
  name: string,
  phone: string,
  options?: {
    serviceArea?: string[];
    specialties?: string[];
  }
): Promise<{ success: boolean; userId?: string; error?: string }> {
  const verification = await verifyInviteToken(token);
  if (!verification.valid || !verification.email) {
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

  let providerRecordId: string;

  if (
    verification.inviteType === "admin" &&
    verification.providerId
  ) {
    // Admin invite: link user to the pre-existing provider record
    providerRecordId = verification.providerId;
    await db
      .update(providers)
      .set({
        userId: newUser.id,
        name,
        phone,
        status: "onboarding",
        specialties: options?.specialties ?? [],
        serviceAreas: options?.serviceArea ?? [],
        updatedAt: new Date(),
      })
      .where(eq(providers.id, verification.providerId));
  } else {
    // Referral or beta invite: create a new provider record
    const commissionRate =
      verification.inviteType === "beta"
        ? COMMISSION_RATE_MECHANICS_BP
        : undefined;

    const [newProvider] = await db
      .insert(providers)
      .values({
        id: createId(),
        userId: newUser.id,
        name,
        email: verification.email,
        phone,
        status: "onboarding",
        specialties: options?.specialties ?? [],
        serviceAreas: options?.serviceArea ?? [],
        ...(commissionRate !== undefined && { commissionRate }),
      })
      .returning({ id: providers.id });

    providerRecordId = newProvider.id;
  }

  // Create onboarding steps for the provider
  const steps = ONBOARDING_STEP_TYPES.map((stepType) => ({
    id: createId(),
    providerId: providerRecordId,
    stepType,
    status: "pending" as const,
  }));
  await db.insert(onboardingSteps).values(steps);

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

export async function sendBetaInviteEmail(
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
          <h2>You're Selected for the RoadSide ATL Beta Program</h2>
          <p>Hi ${name || "there"},</p>
          <p>You've been selected for early access to the RoadSide ATL provider platform. Limited beta spots are available, so don't wait -- click the button below to claim yours:</p>
          <p style="text-align: center;">
            <a href="${inviteUrl}" class="button">Join the Beta</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; font-size: 14px; color: #666;">${inviteUrl}</p>
          <p>This link will expire in 7 days.</p>
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
    subject: "You're Selected for the RoadSide ATL Beta Program",
    html,
  });
}

export async function sendReferralInviteEmail(
  email: string,
  name: string,
  token: string,
  referrerName: string
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
          <h2>${referrerName} invited you to join RoadSide ATL</h2>
          <p>Hi ${name || "there"},</p>
          <p>${referrerName} thinks you'd be a great fit for the RoadSide ATL provider team. Join us and start earning by providing roadside assistance services in the Atlanta metro area.</p>
          <p style="text-align: center;">
            <a href="${inviteUrl}" class="button">Join the Team</a>
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
    subject: `${referrerName} invited you to join RoadSide ATL`,
    html,
  });
}

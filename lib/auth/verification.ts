import { db } from "@/db";
import { verificationTokens, passwordResetTokens } from "@/db/schema/auth";
import { users } from "@/db/schema/users";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { sendEmail } from "@/lib/notifications/email";

const VERIFICATION_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_EXPIRY = 60 * 60 * 1000; // 1 hour

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createVerificationToken(email: string): Promise<string> {
  const token = generateToken();
  const expires = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY);

  // Delete any existing tokens for this email
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, email));

  // Create new token
  await db.insert(verificationTokens).values({
    identifier: email,
    token,
    expires,
  });

  return token;
}

export async function verifyEmailToken(token: string): Promise<{ success: boolean; email?: string; error?: string }> {
  const record = await db.query.verificationTokens.findFirst({
    where: eq(verificationTokens.token, token),
  });

  if (!record) {
    return { success: false, error: "Invalid or expired verification link" };
  }

  if (new Date() > record.expires) {
    // Delete expired token
    await db.delete(verificationTokens).where(eq(verificationTokens.token, token));
    return { success: false, error: "Verification link has expired" };
  }

  // Mark email as verified
  await db
    .update(users)
    .set({ emailVerified: new Date(), updatedAt: new Date() })
    .where(eq(users.email, record.identifier));

  // Delete the token
  await db.delete(verificationTokens).where(eq(verificationTokens.token, token));

  return { success: true, email: record.identifier };
}

export async function sendVerificationEmail(email: string, name: string): Promise<void> {
  const token = await createVerificationToken(email);
  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

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
          <h2>Verify Your Email</h2>
          <p>Hi ${name || "there"},</p>
          <p>Thanks for signing up! Please verify your email address by clicking the button below:</p>
          <p style="text-align: center;">
            <a href="${verifyUrl}" class="button">Verify Email</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; font-size: 14px; color: #666;">${verifyUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, you can safely ignore this email.</p>
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
    subject: "Verify your email - RoadSide ATL",
    html,
  });
}

// Password Reset Functions
export async function createPasswordResetToken(email: string): Promise<string> {
  const token = generateToken();
  const expires = new Date(Date.now() + PASSWORD_RESET_EXPIRY);

  // Delete any existing tokens for this email
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.identifier, email));

  // Create new token
  await db.insert(passwordResetTokens).values({
    identifier: email,
    token,
    expires,
  });

  return token;
}

export async function verifyPasswordResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
  const record = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.token, token),
  });

  if (!record) {
    return { valid: false };
  }

  if (new Date() > record.expires) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return { valid: false };
  }

  return { valid: true, email: record.identifier };
}

export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const result = await verifyPasswordResetToken(token);
  if (!result.valid || !result.email) return null;

  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
  return result.email;
}

export async function sendPasswordResetEmail(email: string, name: string): Promise<void> {
  const token = await createPasswordResetToken(email);
  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

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
          <h2>Reset Your Password</h2>
          <p>Hi ${name || "there"},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <p style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; font-size: 14px; color: #666;">${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, you can safely ignore this email.</p>
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
    subject: "Reset your password - RoadSide ATL",
    html,
  });
}

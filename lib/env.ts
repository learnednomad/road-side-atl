/**
 * Environment variable validation — fails fast at startup if required vars are missing.
 * Import this module early to catch misconfigurations before the app starts serving.
 */

import { z } from "zod/v4";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.url("DATABASE_URL must be a valid PostgreSQL connection string"),

  // Auth
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),

  // Optional — app works without these but features are degraded
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),

  // Encryption
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, "ENCRYPTION_KEY must be 64 hex characters (32 bytes)").optional(),

  // AWS (all optional — S3 features degrade gracefully)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string().optional(),
  AWS_REGION: z.string().optional(),

  // Server config
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  TRUST_PROXY: z.string().optional(),
  DISABLE_CRON: z.string().optional(),
});

function validateEnv() {
  // Skip validation during build (Next.js imports modules at build time)
  if (process.env.SKIP_ENV_VALIDATION === "1") return;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("========================================");
    console.error("ENVIRONMENT VALIDATION FAILED");
    console.error("========================================");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    console.error("========================================");

    // In production, exit immediately. In dev, warn but continue.
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }

  // Warn about placeholder values in production
  if (process.env.NODE_ENV === "production") {
    const placeholders: string[] = [];
    if (process.env.STRIPE_SECRET_KEY?.includes("xxx")) placeholders.push("STRIPE_SECRET_KEY");
    if (process.env.STRIPE_WEBHOOK_SECRET?.includes("xxx")) placeholders.push("STRIPE_WEBHOOK_SECRET");
    if (process.env.RESEND_API_KEY?.includes("your-")) placeholders.push("RESEND_API_KEY");
    if (process.env.AUTH_GOOGLE_ID?.includes("your-")) placeholders.push("AUTH_GOOGLE_ID");
    if (process.env.AUTH_GOOGLE_SECRET?.includes("your-")) placeholders.push("AUTH_GOOGLE_SECRET");

    if (placeholders.length > 0) {
      console.warn("========================================");
      console.warn("WARNING: Placeholder values detected in production:");
      for (const key of placeholders) {
        console.warn(`  ${key} appears to be a placeholder`);
      }
      console.warn("========================================");
    }
  }

  // Warn about partial AWS configuration
  const awsVars = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BUCKET_NAME", "AWS_REGION"];
  const awsSet = awsVars.filter((k) => process.env[k]);
  if (awsSet.length > 0 && awsSet.length < awsVars.length) {
    const missing = awsVars.filter((k) => !process.env[k]);
    console.warn("WARNING: Partial AWS configuration. Missing:", missing.join(", "));
  }
}

validateEnv();

import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { loginSchema } from "./validators";
import { assertLoginAllowed, recordLoginFailure, clearLoginThrottle } from "./auth/login-throttle";

export default {
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Brute-force throttle (per-email + per-IP, Postgres-backed, durable).
        // Read-only gate first — throws "TooManyAttempts" if locked out; the
        // counter is incremented only on an actual failed attempt below.
        const headers =
          request instanceof Request ? request.headers : undefined;
        await assertLoginAllowed(parsed.data.email, headers);

        const user = await db.query.users.findFirst({
          where: eq(users.email, parsed.data.email),
        });

        if (!user?.password) {
          await recordLoginFailure(parsed.data.email, headers);
          return null;
        }

        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (!valid) {
          await recordLoginFailure(parsed.data.email, headers);
          return null;
        }

        // Require a verified email for all roles. Seeded admins are created
        // with emailVerified set, so this does not lock them out. (Not a
        // credential failure — don't count it toward the throttle.)
        if (!user.emailVerified) {
          throw new Error("EmailNotVerified");
        }

        // Successful login — clear the email + IP counters.
        await clearLoginThrottle(parsed.data.email, headers);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
    ...(process.env.AUTH_RESEND_KEY
      ? [
          Resend({
            apiKey: process.env.AUTH_RESEND_KEY,
            from: process.env.AUTH_RESEND_FROM || process.env.RESEND_FROM || "noreply@roadsidega.com",
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: "customer" | "admin" | "provider" }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "customer" | "admin" | "provider";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

/**
 * Framework-agnostic client-IP resolution, shared by the Hono rate-limit
 * middleware and the NextAuth credentials login.
 *
 * Returns `null` when no client can be identified — callers MUST treat that as
 * "cannot rate limit this request" and fail open, never collapse it to a shared
 * constant (that would lump every unidentified request into one global bucket).
 *
 * When deployed behind a reverse proxy (Coolify/Traefik, nginx, Cloudflare),
 * set TRUST_PROXY=true so forwarded headers are honored. Without it, the app
 * only sees the proxy's IP and cannot distinguish real clients.
 */

type HeaderGetter = (name: string) => string | null | undefined;

// Warn at most once per minute when the IP can't be resolved, so a
// misconfigured deployment (TRUST_PROXY unset behind a proxy) is visible
// without flooding the logs.
let lastUnresolvedWarn = 0;

export function resolveClientIp(getHeader: HeaderGetter): string | null {
  // Cloudflare sets this and overwrites any client-supplied value, so it is
  // trustworthy whenever the app actually sits behind Cloudflare.
  const cfIp = getHeader("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // Forwarded headers are spoofable unless a trusted proxy sets them, so only
  // honor them when explicitly running behind one.
  if (process.env.TRUST_PROXY === "true") {
    const realIp = getHeader("x-real-ip");
    if (realIp) return realIp.trim();

    // X-Forwarded-For: "client, proxy1, proxy2" — leftmost is the originator.
    const forwarded = getHeader("x-forwarded-for");
    if (forwarded) {
      const client = forwarded.split(",")[0]?.trim();
      if (client) return client;
    }
  }

  const now = Date.now();
  if (now - lastUnresolvedWarn > 60000) {
    lastUnresolvedWarn = now;
    console.warn(
      "[RateLimit] Could not resolve client IP — failing open (no rate limit applied). " +
        "If this app is behind a reverse proxy, set TRUST_PROXY=true."
    );
  }
  return null;
}

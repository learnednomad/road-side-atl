/**
 * Parse + sanitize page/limit query params. Guards against NaN (e.g. ?page=abc),
 * negative/zero values, and oversized limits (resource exhaustion). Returns a
 * 1-based page, a limit clamped to [1, maxLimit], and the computed offset.
 */
export function parsePagination(
  pageRaw?: string | null,
  limitRaw?: string | null,
  opts?: { defaultLimit?: number; maxLimit?: number },
): { page: number; limit: number; offset: number } {
  const defaultLimit = opts?.defaultLimit ?? 20;
  const maxLimit = opts?.maxLimit ?? 100;
  const page = Math.max(1, Math.floor(Number(pageRaw)) || 1);
  const limit = Math.min(Math.max(1, Math.floor(Number(limitRaw)) || defaultLimit), maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}

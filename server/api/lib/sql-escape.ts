/**
 * Escape LIKE/ILIKE wildcards so user-supplied search text matches literally.
 *
 * Without this, a `%` or `_` in the query broadens the match (and `%foo%`
 * patterns built from raw input can force expensive sequential scans).
 * Postgres' default LIKE escape character is backslash, so escaping `\ % _`
 * with a backslash is sufficient — no explicit ESCAPE clause needed.
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

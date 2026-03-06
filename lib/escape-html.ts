/**
 * Escape HTML special characters to prevent XSS in raw HTML templates.
 * Use this for ALL user-sourced values interpolated into HTML strings
 * (invoices, receipts, emails, etc.).
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

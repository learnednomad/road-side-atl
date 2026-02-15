/**
 * Audit logging for tracking admin and system actions
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";

export type AuditAction =
  | "booking.create"
  | "booking.update"
  | "booking.status_change"
  | "booking.assign_provider"
  | "booking.cancel"
  | "provider.create"
  | "provider.update"
  | "provider.delete"
  | "provider.status_change"
  | "payout.create"
  | "payout.mark_paid"
  | "payment.confirm"
  | "payment.refund"
  | "user.login"
  | "user.logout"
  | "user.register"
  | "settings.update"
  | "auto_dispatch.attempt"
  | "auto_dispatch.success"
  | "auto_dispatch.failure"
  | "provider.invite"
  | "provider.invite_accepted"
  | "provider.self_register"
  | "invoice.generate"
  | "invoice.create_standalone"
  | "invoice.issue"
  | "invoice.void"
  | "trust_tier.promote"
  | "trust_tier.demote"
  | "trust_tier.admin_override"
  | "trust_tier.bypass_attempt";

export interface AuditLogEntry {
  action: AuditAction;
  userId?: string | null;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// In-memory buffer for batch writes
const logBuffer: AuditLogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Log an audit event
 * Events are buffered and written in batches for performance
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  logBuffer.push({
    ...entry,
    details: entry.details || {},
  });

  // Schedule batch write if not already scheduled
  if (!flushTimer) {
    flushTimer = setTimeout(flushLogs, 1000);
  }

  // Force flush if buffer is large
  if (logBuffer.length >= 50) {
    await flushLogs();
  }
}

/**
 * Flush buffered logs to database
 */
async function flushLogs(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (logBuffer.length === 0) return;

  const entries = logBuffer.splice(0, logBuffer.length);

  try {
    // Create audit_logs table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        user_id VARCHAR(255),
        resource_type VARCHAR(100),
        resource_id VARCHAR(255),
        details JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Batch insert
    for (const entry of entries) {
      await db.execute(sql`
        INSERT INTO audit_logs (action, user_id, resource_type, resource_id, details, ip_address, user_agent)
        VALUES (
          ${entry.action},
          ${entry.userId || null},
          ${entry.resourceType || null},
          ${entry.resourceId || null},
          ${JSON.stringify(entry.details)}::jsonb,
          ${entry.ipAddress || null},
          ${entry.userAgent || null}
        )
      `);
    }
  } catch (error) {
    // Log to console as fallback, don't lose the audit data
    console.error("[Audit] Failed to write logs:", error);
    for (const entry of entries) {
      console.log("[Audit]", JSON.stringify(entry));
    }
  }
}

/**
 * Helper to extract request info for audit logging
 */
export function getRequestInfo(request: Request): {
  ipAddress: string;
  userAgent: string;
} {
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  return { ipAddress, userAgent };
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(filters: {
  action?: AuditAction;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<unknown[]> {
  const conditions: string[] = [];

  if (filters.action) {
    conditions.push(`action = '${filters.action}'`);
  }
  if (filters.userId) {
    conditions.push(`user_id = '${filters.userId}'`);
  }
  if (filters.resourceType) {
    conditions.push(`resource_type = '${filters.resourceType}'`);
  }
  if (filters.resourceId) {
    conditions.push(`resource_id = '${filters.resourceId}'`);
  }
  if (filters.startDate) {
    conditions.push(`created_at >= '${filters.startDate.toISOString()}'`);
  }
  if (filters.endDate) {
    conditions.push(`created_at <= '${filters.endDate.toISOString()}'`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  try {
    const result = await db.execute(sql.raw(`
      SELECT * FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `));
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

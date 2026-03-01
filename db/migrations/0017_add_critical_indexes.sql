-- Critical database indexes for production performance
-- These prevent full table scans on frequently queried columns

-- Bookings: most queried table
CREATE INDEX CONCURRENTLY IF NOT EXISTS "bookings_user_id_idx" ON "bookings" ("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "bookings_provider_id_idx" ON "bookings" ("providerId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "bookings_status_idx" ON "bookings" ("status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "bookings_created_at_idx" ON "bookings" ("createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "bookings_tenant_id_idx" ON "bookings" ("tenantId");

-- Payments: lookups by booking and stripe session
CREATE INDEX CONCURRENTLY IF NOT EXISTS "payments_booking_id_idx" ON "payments" ("bookingId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "payments_stripe_session_idx" ON "payments" ("stripeSessionId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "payments_status_idx" ON "payments" ("status");

-- Providers: filtered by status and user
CREATE INDEX CONCURRENTLY IF NOT EXISTS "providers_user_id_idx" ON "providers" ("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "providers_status_idx" ON "providers" ("status");

-- Provider payouts: reporting queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "payouts_provider_id_idx" ON "provider_payouts" ("providerId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "payouts_booking_id_idx" ON "provider_payouts" ("bookingId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "payouts_status_idx" ON "provider_payouts" ("status");

-- Invoices: customer and status lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS "invoices_customer_id_idx" ON "invoices" ("customerId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "invoices_status_idx" ON "invoices" ("status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "invoices_booking_id_idx" ON "invoices" ("bookingId");

-- Reviews: provider ratings aggregation
CREATE INDEX CONCURRENTLY IF NOT EXISTS "reviews_provider_id_idx" ON "reviews" ("provider_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "reviews_customer_id_idx" ON "reviews" ("customer_id");

-- Dispatch logs: booking lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS "dispatch_logs_booking_id_idx" ON "dispatch_logs" ("bookingId");

-- Audit logs: query filtering (created dynamically, index if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs" ("user_id")';
    EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action")';
    EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at")';
    EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_resource_idx" ON "audit_logs" ("resource_type", "resource_id")';
  END IF;
END $$;

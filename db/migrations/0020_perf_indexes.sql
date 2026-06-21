CREATE INDEX "idx_bookings_status_created" ON "bookings" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "idx_bookings_created" ON "bookings" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_bookings_user" ON "bookings" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_bookings_provider_status" ON "bookings" USING btree ("providerId","status");--> statement-breakpoint
CREATE INDEX "idx_bookings_service" ON "bookings" USING btree ("serviceId");--> statement-breakpoint
CREATE INDEX "idx_payments_booking" ON "payments" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "idx_payments_status_created" ON "payments" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "idx_payouts_provider_type_status" ON "provider_payouts" USING btree ("providerId","payoutType","status");--> statement-breakpoint
CREATE INDEX "idx_payouts_status" ON "provider_payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payouts_created" ON "provider_payouts" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_dispatch_logs_booking" ON "dispatch_logs" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "idx_dispatch_logs_provider" ON "dispatch_logs" USING btree ("assignedProviderId");
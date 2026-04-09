-- Remove beta toggle system (mechanics is now a permanent service category)
-- Beta invites (inviteType="beta") are preserved for ongoing use
DROP TABLE IF EXISTS "beta_users";
DELETE FROM "platform_settings"
  WHERE "key" IN ('beta_active', 'beta_start_date', 'beta_end_date', 'beta_provider_slots');

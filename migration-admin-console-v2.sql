-- StudyHelp — Stage 6 (core): admin console support, CORRECTED
-- v1 failed: `granted_at` already existed on entitlements (pre-existing column,
-- default unixepoch(), used for every entitlement row, not just manual ones).
-- This version skips it and only adds genuinely new columns.
--
-- Also note: order_id and payment_id are NOT NULL on the real table. Manual
-- grants use '' (empty string) as the "no real payment" sentinel instead of
-- NULL — the Worker code has been updated to match.

ALTER TABLE entitlements ADD COLUMN granted_reason TEXT;
ALTER TABLE entitlements ADD COLUMN granted_by TEXT;
ALTER TABLE entitlements ADD COLUMN revoked_at INTEGER;
ALTER TABLE entitlements ADD COLUMN revoked_reason TEXT;
ALTER TABLE entitlements ADD COLUMN revoked_by TEXT;

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  admin_identifier TEXT NOT NULL,
  user_id TEXT,
  subject_id TEXT,
  entitlement_id TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  session_token_hash TEXT NOT NULL,
  admin_identifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Stage 3: Account system columns
-- Run against studyhelp-db (remote) on the final Cloudflare account

ALTER TABLE users ADD COLUMN name TEXT;
ALTER TABLE users ADD COLUMN passcode_hash TEXT;
ALTER TABLE users ADD COLUMN recovery_email TEXT;

-- phone is the primary login identifier per spec (Section 2) — must be unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Sessions table for login sessions (separate from device_sessions,
-- which already exists for device/session limiting in Stage 4)
CREATE TABLE IF NOT EXISTS login_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_token_hash TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- OTP table for forgot-passcode flow
CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'passcode_reset',
  attempts INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Rate limiting for OTP sends (per-phone, per-hour cap per Section 4)
CREATE TABLE IF NOT EXISTS otp_send_log (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  sent_at INTEGER DEFAULT (unixepoch())
);

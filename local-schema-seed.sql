-- studyhelp local D1 schema seed
-- Generated from production schema dump (Aug 12 2026) so local dev matches
-- remote exactly. Run once against your local D1 replica:
--   wrangler d1 execute studyhelp-db --local --file local-schema-seed.sql
--
-- Safe to re-run: every CREATE TABLE uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  name TEXT,
  passcode_hash TEXT,
  recovery_email TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  last_verify_attempt INTEGER,
  pending_recovery_email TEXT,
  last_email_change_attempt INTEGER,
  verify_fail_count INTEGER DEFAULT 0,
  verify_locked_until INTEGER
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_paise INTEGER NOT NULL,
  title_native TEXT,
  title_english TEXT,
  popular INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  granted_at INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER,
  granted_reason TEXT,
  granted_by TEXT,
  revoked_at INTEGER,
  revoked_reason TEXT,
  revoked_by TEXT,
  UNIQUE(user_id, subject_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Legacy table, superseded by login_sessions (single-session policy,
-- Aug 3 2026). Kept here only so local schema matches remote exactly;
-- not written to by any current worker code.
CREATE TABLE IF NOT EXISTS device_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_label TEXT,
  last_active INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS login_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_token_hash TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER,
  revoked_reason TEXT,
  revoked_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

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

CREATE TABLE IF NOT EXISTS otp_send_log (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  sent_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS support_requests (
  id TEXT PRIMARY KEY,
  phone TEXT,
  recovery_email TEXT,
  payment_or_order_id TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER DEFAULT (unixepoch()),
  contact_email TEXT
);

CREATE TABLE IF NOT EXISTS chapter_content (
  chapter_slug TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  chapter_number INTEGER,
  title TEXT,
  answers_json TEXT NOT NULL,
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

CREATE TABLE IF NOT EXISTS free_click_log (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,        -- 'user' | 'anon' | 'fp'
  actor_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  click_date TEXT NOT NULL,        -- 'YYYY-MM-DD', UTC calendar day
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(actor_type, actor_id, subject_id, click_date)
);

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

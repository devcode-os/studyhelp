-- Support request submissions (public-facing /support/ form)
-- Run against studyhelp-db (remote) on the final Cloudflare account

CREATE TABLE IF NOT EXISTS support_requests (
  id TEXT PRIMARY KEY,
  phone TEXT,
  recovery_email TEXT,
  payment_or_order_id TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER DEFAULT (unixepoch())
);
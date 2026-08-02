-- Add a separate "contact email" field to support_requests: where support should
-- reply, distinct from recovery_email (which the student may not have access to).
-- Run against studyhelp-db (remote) on the final Cloudflare account

ALTER TABLE support_requests ADD COLUMN contact_email TEXT;

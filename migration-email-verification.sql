-- StudyHelp — Email verification migration
-- Adds email_verified flag + rate-limit timestamp to users table.
-- OTP storage reuses the existing otp_codes table (purpose = 'email_verify'),
-- same as passcode_reset does — no new OTP table needed.

ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_verify_attempt INTEGER;

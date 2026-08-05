-- StudyHelp — self-service recovery email change
-- New email is staged in pending_recovery_email and only promoted to the
-- real recovery_email once the OTP sent to the NEW address is confirmed.
-- Keeps the existing recovery_email untouched (and the account still
-- recoverable) if the student never completes verification.

ALTER TABLE users ADD COLUMN pending_recovery_email TEXT;
ALTER TABLE users ADD COLUMN last_email_change_attempt INTEGER;

-- StudyHelp — shared verification lockout
-- Applies across BOTH "verify current email" and "change + verify new email"
-- flows, since they're fundamentally the same "prove you own this address"
-- gate. 2 wrong OTP entries -> locked for 24 hours before another attempt
-- (send or confirm) is allowed. Resets to 0 / NULL on any successful confirm.

ALTER TABLE users ADD COLUMN verify_fail_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN verify_locked_until INTEGER;

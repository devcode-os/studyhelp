-- StudyHelp — 45-day unlimited access window
-- Adds expires_at to entitlements. All entitlements granted from now on
-- expire 45 days after purchase (set by the Worker at grant time).
--
-- Safe to run even with existing test-mode rows: NULL expires_at rows
-- (granted before this migration) will simply never match the
-- "expires_at > now" checks the Worker now uses everywhere, meaning any
-- old test entitlements are treated as expired/inactive rather than
-- permanently unlocked. No real customers existed at the time of this
-- migration, so this has no live-customer impact.

ALTER TABLE entitlements ADD COLUMN expires_at INTEGER;

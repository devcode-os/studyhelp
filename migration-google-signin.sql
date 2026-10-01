-- StudyHelp — Google sign-in
-- Additive only: one new nullable column + a unique index on it.
-- Existing rows get NULL and nothing else changes. No data is moved or deleted.
--
-- Run BEFORE deploying the Worker that contains /auth/google:
--   npx wrangler d1 export studyhelp-db --remote --output=studyhelp-backup-YYYY-MM-DD.sql
--   npx wrangler d1 execute studyhelp-db --remote --file=migration-google-signin.sql
--
-- google_sub = Google's stable account ID ("sub" claim). A unique index on a
-- nullable column allows any number of NULLs, so phone/passcode users are unaffected.

ALTER TABLE users ADD COLUMN google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);

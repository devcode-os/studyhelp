-- StudyHelp — 3-day free trial (Google sign-in users only)
-- Additive only: one new table. Nothing existing is changed or moved.
--
-- trial_claims records "this Google account has used its one free trial".
-- It is keyed by google_sub (Google's stable account ID) and has NO foreign
-- key to users on purpose: deleting a StudyHelp account must NOT erase the
-- fact that the trial was used, or someone could delete + re-signup to get
-- another trial.
--
-- Run BEFORE deploying the Worker that contains /trial/*:
--   npx wrangler d1 export studyhelp-db --remote --output=studyhelp-backup-YYYY-MM-DD.sql
--   npx wrangler d1 execute studyhelp-db --remote --file=migration-free-trial.sql

CREATE TABLE IF NOT EXISTS trial_claims (
  google_sub TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trial_claims_user ON trial_claims(user_id);

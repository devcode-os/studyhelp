-- Tracks daily free-answer clicks for subjects the visitor has NOT purchased.
-- Purchased subjects are always unlimited (checked via existing entitlements table,
-- bypasses this entirely). One row per (actor, subject, day); count increments
-- on each new answer reveal.
--
-- actor_type = 'user'  -> actor_id = real user_id (logged in, not yet purchased this subject)
-- actor_type = 'anon'  -> actor_id = anonymous cookie ID (not logged in at all)

CREATE TABLE IF NOT EXISTS free_click_log (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,        -- 'user' | 'anon'
  actor_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  click_date TEXT NOT NULL,        -- 'YYYY-MM-DD', UTC calendar day
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(actor_type, actor_id, subject_id, click_date)
);
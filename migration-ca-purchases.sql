-- migration-ca-purchases.sql
-- Current Affairs PDF purchases.
--
-- item_id is always the R2 object filename minus ".pdf" (see caCatalog.js)
-- e.g. "current-affairs-august-2026" or
-- "current-affairs-last3-jun-jul-aug-2026" -- so r2_object_key is always
-- derivable as `${item_id}.pdf`, kept as its own column below anyway so a
-- future rename/versioning scheme never needs a schema migration.
--
-- Run once:
--   wrangler d1 execute studyhelp-db --remote --file=./migration-ca-purchases.sql

CREATE TABLE IF NOT EXISTS ca_purchases (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT    NOT NULL,
  item_id        TEXT    NOT NULL,   -- e.g. 'current-affairs-august-2026'
  item_type      TEXT    NOT NULL,   -- 'month' | 'bundle3' | 'bundle6'
  month_range    TEXT    NOT NULL,   -- e.g. 'August 2026' or 'June, July, August 2026'
  amount_paise   INTEGER NOT NULL,
  r2_object_key  TEXT    NOT NULL,   -- e.g. 'current-affairs-august-2026.pdf'
  purchase_date  TEXT    NOT NULL DEFAULT (datetime('now')),

  -- Blocks duplicate rows from a re-click/double-submit at checkout --
  -- ownership becomes a plain existence query, no dedup logic needed
  -- anywhere downstream.
  UNIQUE (user_id, item_id)
);

-- Every lookup here is "give me everything this user owns" (one call
-- powers every Buy/Download button on the CA page), so this is the only
-- index that matters.
CREATE INDEX IF NOT EXISTS idx_ca_purchases_user
  ON ca_purchases (user_id);

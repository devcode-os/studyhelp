-- migration-ca-orders-v2.sql
-- Replaces the earlier single-item_id ca_orders schema. Safe to drop and
-- recreate -- no real orders have been processed through the old schema
-- yet. item_ids is a JSON array so one order can cover: a single month,
-- a single combined bundle, an arbitrary multi-month custom purchase, or
-- a fixed-price "Individual" bundle deal (3 or 6 real months at a
-- discounted flat price) -- one order shape for all four cases.
--
-- Run once:
--   wrangler d1 execute studyhelp-db --remote --file=./migration-ca-orders-v2.sql

DROP TABLE IF EXISTS ca_orders;

CREATE TABLE ca_orders (
  id             TEXT    PRIMARY KEY,  -- Razorpay order id
  user_id        TEXT    NOT NULL,
  item_ids       TEXT    NOT NULL,     -- JSON array, e.g. '["current-affairs-june-2026","current-affairs-july-2026"]'
  amount_paise   INTEGER NOT NULL,     -- total charged for the whole order
  status         TEXT    NOT NULL DEFAULT 'created'  -- 'created' | 'paid' | 'failed'
);

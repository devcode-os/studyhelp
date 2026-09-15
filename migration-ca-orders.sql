-- migration-ca-orders.sql
-- Second, additive migration -- ca_purchases already exists (applied
-- earlier). This adds ca_orders: tracks a Razorpay order from creation
-- through webhook confirmation, mirroring the existing "orders" table's
-- role for Subjects. Kept separate from "orders" since that table's
-- subject_id column is a NOT NULL foreign key to subjects, which a CA
-- item_id string doesn't fit.
--
-- Run once:
--   wrangler d1 execute studyhelp-db --remote --file=./migration-ca-orders.sql

CREATE TABLE IF NOT EXISTS ca_orders (
  id             TEXT    PRIMARY KEY,  -- Razorpay order id
  user_id        TEXT    NOT NULL,
  item_id        TEXT    NOT NULL,
  amount_paise   INTEGER NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'created'  -- 'created' | 'paid' | 'failed'
);

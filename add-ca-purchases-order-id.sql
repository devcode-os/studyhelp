-- Run once against studyhelp-db before deploying the updated worker.
ALTER TABLE ca_purchases ADD COLUMN order_id TEXT;

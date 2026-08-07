-- StudyHelp — Stage 7: subject display fields for dynamic /plans/ page
-- Adds the fields index-plans.astro needs to render cards without a
-- hardcoded array. price_paise already existed; these are new.

ALTER TABLE subjects ADD COLUMN title_native TEXT;
ALTER TABLE subjects ADD COLUMN title_english TEXT;
ALTER TABLE subjects ADD COLUMN popular INTEGER NOT NULL DEFAULT 0;

-- Backfill the two currently-live subjects with their existing display
-- values from the old hardcoded array in index-plans.astro, so nothing
-- changes visually the moment this ships. No-ops harmlessly if either
-- row doesn't exist yet.
UPDATE subjects SET title_native = 'Telangana economy', title_english = 'English', popular = 1
  WHERE id = 'telangana-economy-en';
UPDATE subjects SET title_native = 'తెలంగాణ చరిత్ర', title_english = 'Telangana history', popular = 0
  WHERE id = 'telangana-history-te';

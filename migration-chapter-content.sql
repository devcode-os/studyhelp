-- Chapter answer content, served only by the Worker after an entitlement
-- check — never shipped in the Astro static build.
-- Run against studyhelp-db (remote) on the final Cloudflare account

CREATE TABLE IF NOT EXISTS chapter_content (
  chapter_slug TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  chapter_number INTEGER,
  title TEXT,
  answers_json TEXT NOT NULL,
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);
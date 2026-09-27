CREATE TABLE reading_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  last_chapter_slug TEXT NOT NULL,
  last_chapter_number INTEGER,
  last_chapter_title TEXT,
  chapters_read_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(user_id, subject_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
)

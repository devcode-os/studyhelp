CREATE TABLE ca_reading_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  month_slug TEXT NOT NULL,
  last_question_index INTEGER,
  questions_read_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, month_slug),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

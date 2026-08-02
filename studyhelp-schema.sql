PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE TABLE subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_paise INTEGER NOT NULL
);
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);
CREATE TABLE entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  granted_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(user_id, subject_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);
CREATE TABLE device_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_label TEXT,
  last_active INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

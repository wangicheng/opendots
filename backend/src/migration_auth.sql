-- Migration for Google Auth Support
-- Run this to update your existing database

-- Note: SQLite might fail to add UNIQUE constraint in ALTER TABLE directly.
-- We add column then index.

ALTER TABLE users ADD COLUMN google_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id_unique ON users(google_id);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);

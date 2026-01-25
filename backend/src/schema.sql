-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_color INTEGER,
  avatar_url TEXT,
  github_username TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  last_seen INTEGER
);

-- Levels Table
CREATE TABLE IF NOT EXISTS levels (
  id TEXT PRIMARY KEY,
  author_id TEXT,
  author_name TEXT,
  data TEXT NOT NULL, -- JSON content of the level
  is_published BOOLEAN DEFAULT 0,
  likes INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  clears INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  updated_at INTEGER
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_levels_author ON levels(author_id);
CREATE INDEX IF NOT EXISTS idx_levels_published ON levels(is_published);

-- Likes Table (User <-> Level)
CREATE TABLE IF NOT EXISTS likes (
  user_id TEXT,
  level_id TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (user_id, level_id)
);

-- User Table
CREATE TABLE user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified BOOLEAN NOT NULL,
    image TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

-- Session Table
CREATE TABLE session (
    id TEXT PRIMARY KEY,
    expiresAt INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL REFERENCES user(id)
);

-- Account Table
CREATE TABLE account (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL REFERENCES user(id),
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt INTEGER,
    refreshTokenExpiresAt INTEGER,
    scope TEXT,
    password TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

-- Verification Table
CREATE TABLE verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
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

-- Sessions Table for Auth
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- Add google_id column if it doesn't exist (D1 doesn't support IF NOT EXISTS for columns easily in one statement,
-- but since we are re-initializing or this is the source of truth, we define the schema desired)
-- Ideally, we'd alter table, but here we will just append a note or rely on re-creation.
-- For a fresh schema.sql, we should add it to the CREATE TABLE users.


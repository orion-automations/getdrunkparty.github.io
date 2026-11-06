-- Native SQLite database for local Circus Zevyra player accounts.
-- Passwords are stored only as PBKDF2 hashes with individual random salts.

PRAGMA foreign_keys = ON;
PRAGMA user_version = 1;

CREATE TABLE IF NOT EXISTS local_users (
  id TEXT PRIMARY KEY,
  public_uid TEXT NOT NULL UNIQUE
    CHECK (length(public_uid) = 8 AND public_uid NOT GLOB '*[^A-Z0-9]*'),
  username TEXT NOT NULL COLLATE NOCASE UNIQUE
    CHECK (length(trim(username)) BETWEEN 3 AND 32),
  avatar TEXT,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS local_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS local_sessions_expiry_idx
  ON local_sessions(expires_at);

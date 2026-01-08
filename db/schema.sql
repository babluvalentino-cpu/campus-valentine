-- Fresh schema for Campus Valentine (Users + Matches + Messages + RateLimits + AuditLogs)
-- NOTE: This assumes you're early in the project and can recreate tables.
-- If you already have data, write a migration instead of dropping.

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS Messages;
DROP TABLE IF EXISTS Matches;
DROP TABLE IF EXISTS RateLimits;
DROP TABLE IF EXISTS AuditLogs;
DROP TABLE IF EXISTS Users;

-- === Users ===
-- Core user identity + matching fields + wizard data
CREATE TABLE Users (
  id TEXT PRIMARY KEY,                -- UUID v4
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),

  -- Matching-relevant columns (indexed)
  gender TEXT,                        -- 'male', 'female', 'other'
  seeking TEXT,                       -- 'male', 'female', 'other', 'all'
  intent TEXT,                        -- 'relationship', 'friendship'
  year INTEGER,                       -- 1, 2, 3, 4, 5 (5+)

  -- Extra top-level fields
  residence TEXT,                     -- 'day_scholar', 'hosteller' (optional, also in profile_data)
  profile_data TEXT NOT NULL,        -- JSON blob of wizard answers
  bio TEXT,                          -- OPTIONAL; may be NULL or empty string

  -- State flags
  status TEXT NOT NULL DEFAULT 'pending_profile',
  -- 'pending_profile', 'pending_match', 'matched', 'requeuing', 'banned', etc.

  geo_verified INTEGER NOT NULL DEFAULT 0,   -- 0/1
  is_whitelisted INTEGER NOT NULL DEFAULT 0, -- 0/1 (only used by admin tools)
  is_admin INTEGER NOT NULL DEFAULT 0,       -- 0/1

  -- Anti-abuse
  fingerprint_hash TEXT NOT NULL            -- SHA-256 hash of browser fingerprint
);

CREATE INDEX idx_users_username ON Users(username);
CREATE INDEX idx_users_fingerprint_hash ON Users(fingerprint_hash);

-- Matching pool performance
CREATE INDEX idx_users_match_pool
ON Users(status, intent, gender, seeking, year);

-- === Matches ===
CREATE TABLE Matches (
  id TEXT PRIMARY KEY,                     -- UUID v4
  user_a_id TEXT NOT NULL,
  user_b_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  status TEXT NOT NULL DEFAULT 'active',   -- 'active', 'ended_by_user', 'ended_by_admin'

  FOREIGN KEY (user_a_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_b_id) REFERENCES Users(id) ON DELETE CASCADE,
  UNIQUE(user_a_id, user_b_id)
);

-- === Messages ===
CREATE TABLE Messages (
  id TEXT PRIMARY KEY,                     -- UUID v4
  match_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),

  FOREIGN KEY (match_id) REFERENCES Matches(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_match_id_created_at
ON Messages(match_id, created_at);

-- For purge performance
CREATE INDEX idx_messages_created_at
ON Messages(created_at);

-- === Simple rate limits ===
CREATE TABLE RateLimits (
  key TEXT PRIMARY KEY,            -- 'ip:1.2.3.4' or 'fp:hash'
  count INTEGER NOT NULL,
  expires_at TEXT NOT NULL
);

-- === Audit logs ===
CREATE TABLE AuditLogs (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  action TEXT NOT NULL,            -- e.g. 'manual_match', 'unmatch_user', 'whitelist_user'
  target_user_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),

  FOREIGN KEY (admin_user_id) REFERENCES Users(id)
);

DROP TABLE IF EXISTS Messages;
DROP TABLE IF EXISTS Matches;
DROP TABLE IF EXISTS Users;
DROP TABLE IF EXISTS RateLimits;
DROP TABLE IF EXISTS AuditLogs;

CREATE TABLE Users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  gender TEXT,
  seeking TEXT,
  interests TEXT,
  bio TEXT,
  status TEXT NOT NULL DEFAULT 'pending_profile',
  geo_verified INTEGER NOT NULL DEFAULT 0,
  is_whitelisted INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0,
  fingerprint_hash TEXT NOT NULL
);

CREATE INDEX idx_users_username ON Users(username);
CREATE INDEX idx_users_fingerprint_hash ON Users(fingerprint_hash);

CREATE TABLE Matches (
  id TEXT PRIMARY KEY,
  user_a_id TEXT NOT NULL,
  user_b_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (user_a_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_b_id) REFERENCES Users(id) ON DELETE CASCADE,
  UNIQUE(user_a_id, user_b_id)
);

CREATE TABLE Messages (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  FOREIGN KEY (match_id) REFERENCES Matches(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_match_id_created_at ON Messages(match_id, created_at);

CREATE TABLE AuditLogs (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_user_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  FOREIGN KEY (admin_user_id) REFERENCES Users(id)
);

CREATE TABLE RateLimits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at TEXT NOT NULL
);


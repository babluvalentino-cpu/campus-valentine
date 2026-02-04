-- Reports: when a user reports someone in chat, match ends and we store the report for admin review
CREATE TABLE IF NOT EXISTS Reports (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reported_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  FOREIGN KEY (match_id) REFERENCES Matches(id),
  FOREIGN KEY (reporter_id) REFERENCES Users(id),
  FOREIGN KEY (reported_user_id) REFERENCES Users(id)
);

CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON Reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON Reports(created_at);

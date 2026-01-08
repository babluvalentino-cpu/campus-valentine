-- db/migrations/002_profile_match_indexes.sql

-- Speeds up matching pool scans
CREATE INDEX IF NOT EXISTS idx_match_pool
ON Users(status, gender, seeking);

-- Speeds up message retention purges
CREATE INDEX IF NOT EXISTS idx_messages_created_at
ON Messages(created_at);


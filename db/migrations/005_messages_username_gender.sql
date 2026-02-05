-- Add username and gender columns to Messages table for easy reference
ALTER TABLE Messages ADD COLUMN sender_username TEXT;
ALTER TABLE Messages ADD COLUMN sender_gender TEXT;

-- Create index for efficient message retrieval with sender info
CREATE INDEX idx_messages_sender_info
ON Messages(sender_id, sender_username, sender_gender);

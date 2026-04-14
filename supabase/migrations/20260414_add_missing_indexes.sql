-- Add missing indexes for common query patterns
-- hire_requests.sender_email: used for client email lookups
-- users.created_at: used for "newest members" queries and pagination

CREATE INDEX IF NOT EXISTS idx_hire_requests_sender_email ON hire_requests(sender_email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

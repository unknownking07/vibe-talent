ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_freezes_remaining integer NOT NULL DEFAULT 2;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_freezes_used integer NOT NULL DEFAULT 0;

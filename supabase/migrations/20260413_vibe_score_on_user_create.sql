-- Trigger: set baseline vibe score when a new user row is created.
-- Without this, users created after the last backfill migration
-- could sit at vibe_score=0 until their first project/streak/endorsement.

CREATE OR REPLACE FUNCTION trigger_init_vibe_score()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_user_streak(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_create
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_init_vibe_score();

-- ProductPop MVP v1 seed data
-- Idempotent: safe to re-run (uses ON CONFLICT).
-- Run after db/0001_init.sql.

INSERT INTO waitlist (email, source) VALUES
  ('hello@productpop.local',    'seed'),
  ('founder@productpop.local',  'seed'),
  ('designer@productpop.local', 'seed')
ON CONFLICT (email) DO NOTHING;

-- A smoke-test row that the contract test looks for.
-- Engineers can ignore or delete after local dev.
INSERT INTO waitlist (email, source) VALUES
  ('seed-smoke@productpop.local', 'seed')
ON CONFLICT (email) DO NOTHING;

-- CAS-50: Subscription schema for Clerk auth + Stripe billing
-- Idempotent: safe to re-run.

-- Users table to link Clerk ID with Stripe info
CREATE TABLE IF NOT EXISTS users (
  id                BIGSERIAL PRIMARY KEY,
  clerk_user_id     TEXT NOT NULL UNIQUE,
  email             TEXT NOT NULL,
  stripe_customer_id  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_clerk_idx ON users (clerk_user_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (LOWER(email));

-- Subscriptions table for Stripe lifecycle events
CREATE TABLE IF NOT EXISTS subscriptions (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_sub_id     TEXT NOT NULL,
  stripe_price_id   TEXT,
  status            TEXT NOT NULL, -- active, canceled, incomplete, trial, etc.
  trial_ends_at     TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriptions_stripe_sub_idx ON subscriptions (stripe_sub_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions (status);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_active_user_idx 
  ON subscriptions (user_id) WHERE status IN ('active', 'trial');

-- Photo usage tracking for free trial limits (5 photos max)
CREATE TABLE IF NOT EXISTS photo_usage (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  count             INTEGER NOT NULL DEFAULT 0,
  last_reset        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS photo_usage_user_idx ON photo_usage (user_id);
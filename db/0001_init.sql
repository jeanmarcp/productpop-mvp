-- ProductPop MVP v1 schema
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS waitlist (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  source      TEXT NOT NULL DEFAULT 'unknown',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS waitlist_created_at_idx ON waitlist (created_at DESC);
CREATE INDEX IF NOT EXISTS waitlist_source_idx ON waitlist (source);

CREATE TABLE IF NOT EXISTS edits (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT,
  input_url   TEXT NOT NULL,
  output_url  TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'upload',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS edits_email_idx ON edits (LOWER(email));
CREATE INDEX IF NOT EXISTS edits_created_at_idx ON edits (created_at DESC);

-- Optional: capture Vercel deploys / signups
CREATE TABLE IF NOT EXISTS events (
  id          BIGSERIAL PRIMARY KEY,
  kind        TEXT NOT NULL,            -- e.g. 'waitlist_signup', 'remove_bg_call', 'page_view'
  email       TEXT,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_kind_idx ON events (kind);
CREATE INDEX IF NOT EXISTS events_created_at_idx ON events (created_at DESC);

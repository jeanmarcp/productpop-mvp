-- ProductPop referral + reward schema
-- Idempotent: safe to re-run.
--
-- Design notes:
--   * `referral_codes` is the source of truth for "user -> code" mapping.
--     A user is identified by `owner_email` (lowercased) so that we don't
--     require Clerk userId at signup time. When Clerk is wired up, the
--     owner_user_id column will be populated too.
--   * `referral_attributions` records the first touch of a referral cookie.
--     We attribute by the referred email (when they sign up) to make
--     reward eligibility deterministic.
--   * `reward_events` is an append-only ledger. The waitlist POST
--     enqueues a `pending` event; downstream workers can flip it to
--     `granted` when the product ships. This decouples sign-up from
--     fulfillment so we can ship the launch before reward fulfillment.

CREATE TABLE IF NOT EXISTS referral_codes (
  id             BIGSERIAL PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,           -- short, URL-safe
  owner_email    TEXT NOT NULL,                 -- the user who owns this code
  owner_user_id  TEXT,                          -- optional Clerk userId
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_owner_email_uidx
  ON referral_codes (LOWER(owner_email));

CREATE INDEX IF NOT EXISTS referral_codes_owner_user_id_idx
  ON referral_codes (owner_user_id);

CREATE TABLE IF NOT EXISTS referral_attributions (
  id              BIGSERIAL PRIMARY KEY,
  referral_code   TEXT NOT NULL,                -- raw code from URL
  owner_email     TEXT,                          -- resolved owner of the code (nullable if unknown)
  referred_email  TEXT,                          -- populated when they sign up
  user_agent      TEXT,
  ip_hash         TEXT,                          -- salted hash, never raw IP
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attributed_at   TIMESTAMPTZ                   -- set when referred_email resolves
);

CREATE INDEX IF NOT EXISTS referral_attributions_code_idx
  ON referral_attributions (referral_code);

CREATE INDEX IF NOT EXISTS referral_attributions_owner_idx
  ON referral_attributions (owner_email);

CREATE INDEX IF NOT EXISTS referral_attributions_referred_idx
  ON referral_attributions (LOWER(referred_email))
  WHERE referred_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS reward_events (
  id              BIGSERIAL PRIMARY KEY,
  kind            TEXT NOT NULL,                -- e.g. 'referral_signup'
  referrer_email  TEXT,
  referred_email  TEXT NOT NULL,
  referral_code   TEXT,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | granted | revoked
  payload         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS reward_events_status_idx
  ON reward_events (status);

CREATE INDEX IF NOT EXISTS reward_events_referrer_idx
  ON reward_events (LOWER(referrer_email))
  WHERE referrer_email IS NOT NULL;

-- Unique constraint: one open reward event per referred email.
-- Prevents double-grant if the same visitor lands via /r/X then /r/Y.
CREATE UNIQUE INDEX IF NOT EXISTS reward_events_referred_open_uidx
  ON reward_events (LOWER(referred_email))
  WHERE status = 'pending';

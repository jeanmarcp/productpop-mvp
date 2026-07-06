-- Influencer / Affiliate program schema extension
-- Idempotent: safe to re-run.
--
-- Extends the referral_codes table with creator-specific fields
-- and adds a referral_conversions table for commission tracking.

-- 1. Extend referral_codes for creator/influencer codes
ALTER TABLE referral_codes
  ADD COLUMN IF NOT EXISTS creator_name TEXT,
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 0.00,  -- e.g., 30.00 = 30%
  ADD COLUMN IF NOT EXISTS is_influencer_code BOOLEAN DEFAULT FALSE;

-- Index for looking up creator codes by creator name
CREATE INDEX IF NOT EXISTS referral_codes_creator_name_idx
  ON referral_codes (LOWER(creator_name))
  WHERE creator_name IS NOT NULL;

-- Index for finding all influencer codes
CREATE INDEX IF NOT EXISTS referral_codes_influencer_idx
  ON referral_codes (is_influencer_code)
  WHERE is_influencer_code = TRUE;

-- 2. Referral conversions table - tracks paid conversions and commissions
CREATE TABLE IF NOT EXISTS referral_conversions (
  id                     BIGSERIAL PRIMARY KEY,
  referral_code          TEXT NOT NULL,                     -- the code that drove the conversion
  creator_name           TEXT,                              -- denormalized for easy queries
  referrer_email         TEXT,                              -- owner_email from referral_codes
  referred_user_email    TEXT NOT NULL,                     -- the user who converted
  amount                 NUMERIC(12,2) NOT NULL,            -- transaction amount (e.g., 29.00)
  commission_rate        NUMERIC(5,2) NOT NULL,             -- rate at time of conversion (e.g., 30.00)
  commission_amount      NUMERIC(12,2) NOT NULL,            -- calculated commission
  status                 TEXT NOT NULL DEFAULT 'pending',   -- pending | paid | refunded
  stripe_payment_intent_id TEXT,                            -- optional Stripe reference
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS referral_conversions_code_idx
  ON referral_conversions (referral_code);

CREATE INDEX IF NOT EXISTS referral_conversions_creator_idx
  ON referral_conversions (LOWER(creator_name))
  WHERE creator_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS referral_conversions_status_idx
  ON referral_conversions (status);

CREATE INDEX IF NOT EXISTS referral_conversions_referred_idx
  ON referral_conversions (LOWER(referred_user_email));

-- 3. Helper view for creator stats (clicks, signups, conversions, revenue, commission)
-- Combines referral_attributions + referral_conversions + reward_events.
--
-- Joins are case-insensitive because we store the same creator code
-- in different cases depending on entry path:
--   * /c/<code> calls recordAttributionTouch(match.code) -> lowercase
--   * /r/<code> calls recordAttributionTouch(raw.toUpperCase()) -> uppercase
-- The code value in `referral_codes` is stored lowercase (see
-- normalizeCreatorCode), so we case-fold on the join keys to make the
-- aggregations robust regardless of how the touch was recorded.
CREATE OR REPLACE VIEW creator_referral_stats AS
SELECT
  rc.code,
  rc.creator_name,
  rc.owner_email,
  rc.commission_rate,
  COALESCE(clicks.clicks, 0) AS clicks,
  COALESCE(signups.signups, 0) AS signups,
  COALESCE(conversions.conversions, 0) AS conversions,
  COALESCE(conversions.total_revenue, 0) AS total_revenue,
  COALESCE(conversions.total_commission, 0) AS total_commission
FROM referral_codes rc
LEFT JOIN (
  SELECT LOWER(referral_code) AS referral_code, COUNT(*)::bigint AS clicks
  FROM referral_attributions
  GROUP BY LOWER(referral_code)
) clicks ON clicks.referral_code = LOWER(rc.code)
LEFT JOIN (
  SELECT LOWER(referral_code) AS referral_code, COUNT(*)::bigint AS signups
  FROM referral_attributions
  WHERE referred_email IS NOT NULL
  GROUP BY LOWER(referral_code)
) signups ON signups.referral_code = LOWER(rc.code)
LEFT JOIN (
  SELECT
    LOWER(referral_code) AS referral_code,
    COUNT(*)::bigint AS conversions,
    SUM(amount)::numeric(12,2) AS total_revenue,
    SUM(commission_amount)::numeric(12,2) AS total_commission
  FROM referral_conversions
  WHERE status = 'paid'
  GROUP BY LOWER(referral_code)
) conversions ON conversions.referral_code = LOWER(rc.code)
WHERE rc.is_influencer_code = TRUE
  AND rc.disabled_at IS NULL;
// lib/referral.ts
// Referral code generation, cookie helpers, attribution lookup.
//
// Codes are short, URL-safe, and unambiguous. We avoid 0/O/1/I/l to
// keep spoken/dictated referrals readable. Length is 8 characters which
// gives ~26^8 ≈ 2e11 codes — plenty for an MVP launch.

import { cookies, headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { query, withClient } from "@/lib/db";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 chars, no 0/1/I/L/O
const CODE_LEN = 8;
const COOKIE_NAME = "pp_ref";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function generateReferralCode(): string {
  const bytes = randomBytes(CODE_LEN);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export async function ensureReferralCodeForEmail(
  email: string
): Promise<{ code: string; created: boolean }> {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    throw new Error("Invalid email");
  }

  // Try to fetch existing.
  const existing = await query<{ code: string }>(
    `SELECT code FROM referral_codes
       WHERE LOWER(owner_email) = $1 AND disabled_at IS NULL
       LIMIT 1`,
    [clean]
  );
  if (existing.rows.length > 0) {
    return { code: existing.rows[0].code, created: false };
  }

  // Try a few times to insert a unique code (collision is astronomically rare).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const inserted = await query<{ code: string }>(
      `INSERT INTO referral_codes (code, owner_email)
       VALUES ($1, $2)
       ON CONFLICT (code) DO NOTHING
       RETURNING code`,
      [code, clean]
    );
    if (inserted.rows.length > 0) {
      return { code: inserted.rows[0].code, created: true };
    }
  }
  throw new Error("Failed to allocate referral code after retries");
}

export async function lookupReferralCode(
  code: string
): Promise<{ code: string; owner_email: string } | null> {
  const clean = code.trim().toUpperCase();
  if (clean.length === 0) return null;
  const { rows } = await query<{ code: string; owner_email: string }>(
    `SELECT code, owner_email
       FROM referral_codes
       WHERE code = $1 AND disabled_at IS NULL
       LIMIT 1`,
    [clean]
  );
  return rows[0] ?? null;
}

export function recordAttributionTouch(
  code: string,
  ownerEmail: string | null
): Promise<void> {
  const ua = headers().get("user-agent") ?? null;
  return query(
    `INSERT INTO referral_attributions
       (referral_code, owner_email, user_agent)
     VALUES ($1, $2, $3)`,
    [code.trim().toUpperCase(), ownerEmail, ua]
  ).then(() => undefined);
}

export function setReferralCookie(code: string) {
  cookies().set({
    name: COOKIE_NAME,
    value: code.trim().toUpperCase(),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function readReferralCookie(): string | null {
  const v = cookies().get(COOKIE_NAME)?.value;
  return v ? v.trim().toUpperCase() : null;
}

export function clearReferralCookie() {
  cookies().set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Resolve the referral attribution for a sign-up email.
 * Returns the matched code/owner or null if there is no open cookie
 * or the cookie refers to a disabled/unknown code.
 */
export async function resolveAttributionForSignup(
  email: string
): Promise<{ code: string; owner_email: string } | null> {
  const cookieCode = readReferralCookie();
  if (!cookieCode) return null;
  const match = await lookupReferralCode(cookieCode);
  if (!match) return null;
  // Don't credit self-referrals.
  if (match.owner_email.toLowerCase() === email.trim().toLowerCase()) {
    return null;
  }
  return match;
}

// ---------------------------------------------------------------------------
// Influencer / creator code management
// ---------------------------------------------------------------------------
//
// Per-creator codes live in `referral_codes` (existing table) with
// `is_influencer_code=true` and `creator_name` set. We allocate a short,
// human-readable code (e.g., "alex_creates") that creators can put in their
// bio / link-in-bio. We avoid collision with general-user codes by checking
// the existing `referral_codes` table before insert.

const CREATOR_CODE_RE = /^[a-z0-9_]{3,32}$/;

export type CreatorRecord = {
  code: string;
  creator_name: string;
  owner_email: string;
  commission_rate: number;
  is_influencer_code: boolean;
  created_at: string;
};

/**
 * Normalize a human-readable creator code.
 *   "Alex Creates!" -> "alex_creates"
 *   "  Alex.Creates " -> "alex_creates"
 */
export function normalizeCreatorCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

/**
 * Create (or return) a per-creator referral code.
 *
 * If a code already exists for this creator_email with is_influencer_code=true,
 * return it (idempotent). Otherwise insert a new row with the supplied
 * human-readable code. Throws on invalid input or collision with a different
 * existing code.
 */
export async function ensureCreatorCode(input: {
  code: string;
  creator_name: string;
  owner_email: string;
  commission_rate: number; // 0..100
}): Promise<CreatorRecord> {
  const code = normalizeCreatorCode(input.code);
  if (!CREATOR_CODE_RE.test(code)) {
    throw new Error(
      "code must be 3-32 chars, lowercase letters/digits/underscore"
    );
  }
  if (!input.creator_name.trim()) throw new Error("creator_name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.owner_email)) {
    throw new Error("owner_email is invalid");
  }
  if (
    !Number.isFinite(input.commission_rate) ||
    input.commission_rate < 0 ||
    input.commission_rate > 100
  ) {
    throw new Error("commission_rate must be between 0 and 100");
  }
  const email = input.owner_email.trim().toLowerCase();

  return await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      // 1. If this email already has an influencer code, return it.
      const existing = await c.query<CreatorRecord>(
        `SELECT code, creator_name, owner_email, commission_rate::float AS commission_rate,
                is_influencer_code, created_at::text AS created_at
           FROM referral_codes
          WHERE LOWER(owner_email) = $1
            AND is_influencer_code = TRUE
            AND disabled_at IS NULL
          LIMIT 1`,
        [email]
      );
      if (existing.rowCount && existing.rowCount > 0) {
        await c.query("COMMIT");
        return existing.rows[0];
      }

      // 2. Insert the new creator code. The UNIQUE(code) constraint
      //    will reject collision with a general-user code or a different
      //    creator. We rely on the caller to retry on a new code value.
      const inserted = await c.query<CreatorRecord>(
        `INSERT INTO referral_codes
           (code, owner_email, creator_name, commission_rate, is_influencer_code)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (code) DO NOTHING
         RETURNING code, creator_name, owner_email,
                   commission_rate::float AS commission_rate,
                   is_influencer_code,
                   created_at::text AS created_at`,
        [code, email, input.creator_name.trim(), input.commission_rate]
      );
      if (inserted.rowCount && inserted.rowCount > 0) {
        await c.query("COMMIT");
        return inserted.rows[0];
      }
      await c.query("ROLLBACK");
      throw new Error(
        `code "${code}" is already taken; pick a different code`
      );
    } catch (err) {
      try { await c.query("ROLLBACK"); } catch { /* ignore */ }
      throw err;
    }
  });
}

export async function listCreatorCodes(): Promise<CreatorRecord[]> {
  const { rows } = await query<CreatorRecord>(
    `SELECT code, creator_name, owner_email, commission_rate::float AS commission_rate,
            is_influencer_code, created_at::text AS created_at
       FROM referral_codes
      WHERE is_influencer_code = TRUE
        AND disabled_at IS NULL
      ORDER BY created_at DESC`
  );
  return rows;
}

export async function getCreatorCodeByCode(
  code: string
): Promise<CreatorRecord | null> {
  const clean = normalizeCreatorCode(code);
  if (!CREATOR_CODE_RE.test(clean)) return null;
  const { rows } = await query<CreatorRecord>(
    `SELECT code, creator_name, owner_email, commission_rate::float AS commission_rate,
            is_influencer_code, created_at::text AS created_at
       FROM referral_codes
      WHERE code = $1 AND is_influencer_code = TRUE AND disabled_at IS NULL
      LIMIT 1`,
    [clean]
  );
  return rows[0] ?? null;
}

export async function recordAttributionSignup(
  email: string,
  match: { code: string; owner_email: string }
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      // Update the touch with the referred email (last write wins per code+email).
      await c.query(
        `UPDATE referral_attributions
            SET referred_email = $1, attributed_at = NOW()
          WHERE id = (
            SELECT id FROM referral_attributions
              WHERE referral_code = $2
                AND (referred_email IS NULL OR LOWER(referred_email) = $1)
              ORDER BY created_at DESC
              LIMIT 1
          )`,
        [cleanEmail, match.code]
      );
      // Enqueue a pending reward event. The unique partial index prevents
      // double-grant if a visitor lands via /r/X then /r/Y.
      await c.query(
        `INSERT INTO reward_events
           (kind, referrer_email, referred_email, referral_code, status, payload)
         VALUES ('referral_signup', $1, $2, $3, 'pending', $4::jsonb)
         ON CONFLICT DO NOTHING`,
        [
          match.owner_email.toLowerCase(),
          cleanEmail,
          match.code,
          JSON.stringify({ source: "waitlist_signup" }),
        ]
      );
      await c.query("COMMIT");
    } catch (err) {
      await c.query("ROLLBACK");
      throw err;
    }
  });
}

export async function getReferralStats(
  email: string
): Promise<{ code: string | null; invites: number; pending: number; granted: number }> {
  const clean = email.trim().toLowerCase();
  const codeRes = await query<{ code: string }>(
    `SELECT code FROM referral_codes
       WHERE LOWER(owner_email) = $1 AND disabled_at IS NULL
       LIMIT 1`,
    [clean]
  );
  const code = codeRes.rows[0]?.code ?? null;
  if (!code) {
    return { code: null, invites: 0, pending: 0, granted: 0 };
  }
  const statsRes = await query<{ status: string; n: string }>(
    `SELECT status, COUNT(*)::text AS n
       FROM reward_events
       WHERE LOWER(referrer_email) = $1
       GROUP BY status`,
    [clean]
  );
  let pending = 0;
  let granted = 0;
  for (const row of statsRes.rows) {
    const n = Number(row.n);
    if (row.status === "pending") pending += n;
    if (row.status === "granted") granted += n;
  }
  return { code, invites: pending + granted, pending, granted };
}

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

export async function recordAttributionTouch(
  code: string,
  ownerEmail: string | null
): Promise<void> {
  const ua = headers().get("user-agent") ?? null;
  await query(
    `INSERT INTO referral_attributions
       (referral_code, owner_email, user_agent)
     VALUES ($1, $2, $3)`,
    [code.trim().toUpperCase(), ownerEmail, ua]
  );
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

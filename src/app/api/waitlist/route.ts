// app/api/waitlist/route.ts
// POST { email, source? } -> 200 { ok, id, referralCode? } | 400 | 409 | 500
//
// Side-effects on success:
//   * INSERT into waitlist (unique on email).
//   * If the request carries a pp_ref cookie that resolves to a known
//     code owned by a different user, we record the attribution and
//     enqueue a pending reward event (see lib/referral.ts).
//   * Every successful signup gets a referral code created for them
//     so the UI can show "your invite link" right away.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import {
  clearReferralCookie,
  ensureReferralCodeForEmail,
  recordAttributionSignup,
  resolveAttributionForSignup,
} from "@/lib/referral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { email, source } = (body ?? {}) as { email?: unknown; source?: unknown };

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const cleanEmail = email.trim().toLowerCase();
  const cleanSource =
    typeof source === "string" && source.trim().length > 0
      ? source.trim().slice(0, 64)
      : "unknown";

  try {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO waitlist (email, source)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING id::text AS id`,
      [cleanEmail, cleanSource]
    );
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Email already on the waitlist" },
        { status: 409 }
      );
    }

    // Resolve + record referral attribution (best-effort).
    const attribution = await resolveAttributionForSignup(cleanEmail);
    if (attribution) {
      try {
        await recordAttributionSignup(cleanEmail, attribution);
      } catch (err) {
        console.warn("referral attribution failed (non-fatal)", err);
      }
      // Once attributed, the cookie has done its job.
      clearReferralCookie();
    }

    // Always make sure the new user has a code they can share.
    const { code } = await ensureReferralCodeForEmail(cleanEmail);

    // Remember this email for the post-signup share view.
    cookies().set({
      name: "pp_user",
      value: cleanEmail,
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    // Enqueue the referral intro email (best-effort, non-blocking for
    // the user). The marketing worker will drain events.kind =
    // 'email_send:referral-intro' and call the upstream provider.
    try {
      const origin =
        process.env.NEXT_PUBLIC_SITE_URL ||
        req.nextUrl.origin ||
        "http://localhost:3000";
      const link = `${origin.replace(/\/+$/, "")}/r/${code}`;
      await query(
        `INSERT INTO events (kind, email, payload) VALUES ($1, $2, $3::jsonb)`,
        [
          "email_send:referral-intro",
          cleanEmail,
          JSON.stringify({
            to: cleanEmail,
            templateId: "referral-intro",
            vars: { referralCode: code, referralLink: link },
            queuedAt: new Date().toISOString(),
          }),
        ]
      );
    } catch (err) {
      console.warn("referral intro enqueue failed (non-fatal)", err);
    }

    return NextResponse.json({
      ok: true,
      id: rows[0].id,
      referralCode: code,
    });
  } catch (err) {
    console.error("waitlist insert failed", err);
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    );
  }
}

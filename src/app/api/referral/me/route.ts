// app/api/referral/me/route.ts
// GET /api/referral/me?email=foo@bar -> { code, link, invites, pending, granted }
// POST same, body { email }
//
// MVP contract: the email acts as the user identifier until Clerk
// wires in. The same `pp_ref` cookie that the /r/[code] route sets
// is what the UI uses to remember "the email I just signed up with"
// for the post-signup share view. We accept that as a fallback.

import { NextRequest, NextResponse } from "next/server";
import {
  ensureReferralCodeForEmail,
  getReferralStats,
} from "@/lib/referral";
import { cookies, headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function siteOrigin(): string {
  // Prefer explicit env, fall back to Origin/Host header, then localhost.
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const h = headers();
  const origin = h.get("origin");
  if (origin) return origin.replace(/\/+$/, "");
  const host = h.get("host");
  if (host) return `http://${host}`;
  return "http://localhost:3000";
}

async function resolveEmail(req: NextRequest): Promise<string | null> {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("email")?.trim().toLowerCase();
  if (fromQuery && EMAIL_RE.test(fromQuery)) return fromQuery;

  // POST body
  if (req.method === "POST") {
    try {
      const body = (await req.json()) as { email?: unknown };
      const fromBody =
        typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
      if (fromBody && EMAIL_RE.test(fromBody)) return fromBody;
    } catch {
      /* ignore */
    }
  }

  // Cookie fallback (the post-signup flow stores the email briefly).
  const fromCookie = cookies().get("pp_user")?.value?.trim().toLowerCase();
  if (fromCookie && EMAIL_RE.test(fromCookie)) return fromCookie;

  return null;
}

async function handle(req: NextRequest) {
  const email = await resolveEmail(req);
  if (!email) {
    return NextResponse.json(
      { error: "email is required" },
      { status: 400 }
    );
  }
  const { code, created } = await ensureReferralCodeForEmail(email);
  const stats = await getReferralStats(email);
  return NextResponse.json({
    email,
    code,
    link: `${siteOrigin()}/r/${code}`,
    invites: stats.invites,
    pending: stats.pending,
    granted: stats.granted,
    isNewCode: created,
  });
}

export async function GET(req: NextRequest) {
  try {
    return await handle(req);
  } catch (err) {
    console.error("referral/me failed", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handle(req);
  } catch (err) {
    console.error("referral/me failed", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

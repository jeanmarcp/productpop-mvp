// app/c/[code]/route.ts
// Per-creator short link endpoint. Same behavior as /r/[code] but
// exists so the URL can match the format CMO and creators agreed on:
//
//   prepgenie.app/c/<creator_code>
//
// We re-use the /r handler logic by issuing a server-side redirect
// after a quick code lookup + attribution touch.

import { NextRequest, NextResponse } from "next/server";
import {
  lookupReferralCode,
  normalizeCreatorCode,
  recordAttributionTouch,
  setReferralCookie,
} from "@/lib/referral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODE_RE = /^[a-z0-9_]{3,32}$/;

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const raw = (params.code ?? "").toLowerCase();
  const normalized = normalizeCreatorCode(raw);
  if (!CODE_RE.test(normalized)) {
    return NextResponse.redirect(new URL("/?ref_error=invalid", req.url), 302);
  }

  // Per-creator codes live in referral_codes with is_influencer_code=true.
  // We need to look up by exact match (lowercased). lookupReferralCode
  // upper-cases for general-user codes, so do a direct query here.
  const { query } = await import("@/lib/db");
  const { rows } = await query<{ code: string; owner_email: string }>(
    `SELECT code, owner_email
       FROM referral_codes
      WHERE code = $1 AND is_influencer_code = TRUE AND disabled_at IS NULL
      LIMIT 1`,
    [normalized]
  );
  const match = rows[0] ?? null;

  if (!match) {
    await recordAttributionTouch(normalized, null);
    await setReferralCookie(normalized);
    return NextResponse.redirect(
      new URL("/?ref_error=unknown&ref=" + normalized, req.url),
      302
    );
  }

  await recordAttributionTouch(match.code, match.owner_email);
  await setReferralCookie(match.code);
  return NextResponse.redirect(
    new URL("/?ref=" + match.code, req.url),
    302
  );
}

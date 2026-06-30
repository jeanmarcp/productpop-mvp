// app/r/[code]/route.ts
// Referral link handler.
// GET /r/ABCD2345 -> 302 to / with referral cookie set.
//
// We resolve the code, record a touch (first-touch attribution),
// set a 30-day cookie, and redirect to the home page so the visitor
// lands on the waitlist form with attribution intact.

import { NextRequest, NextResponse } from "next/server";
import {
  lookupReferralCode,
  recordAttributionTouch,
  setReferralCookie,
} from "@/lib/referral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODE_RE = /^[A-Z0-9]{4,32}$/;

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const raw = (params.code ?? "").toUpperCase();
  if (!CODE_RE.test(raw)) {
    return NextResponse.redirect(new URL("/?ref_error=invalid", req.url), 302);
  }

  const match = await lookupReferralCode(raw);

  if (!match) {
    // Unknown code: still set the cookie so we know they came via
    // a referral, but flag the unknown owner in the attribution row.
    await recordAttributionTouch(raw, null);
    setReferralCookie(raw);
    return NextResponse.redirect(
      new URL("/?ref_error=unknown&ref=" + raw, req.url),
      302
    );
  }

  await recordAttributionTouch(match.code, match.owner_email);
  setReferralCookie(match.code);
  return NextResponse.redirect(
    new URL("/?ref=" + match.code, req.url),
    302
  );
}

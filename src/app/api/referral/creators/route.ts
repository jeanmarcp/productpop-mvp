// app/api/referral/creators/route.ts
// Admin endpoints for per-creator referral codes (PRE-69).
//
//   GET  /api/referral/creators           -> list all creator codes
//   POST /api/referral/creators           -> create / upsert one
//
// Auth: admin secret in the `x-admin-secret` header. The CMO uses this
// to onboard new influencer partners as Phase 3 begins.

import { NextRequest, NextResponse } from "next/server";
import {
  ensureCreatorCode,
  listCreatorCodes,
  type CreatorRecord,
} from "@/lib/referral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdmin(req: NextRequest): boolean {
  const expected = process.env.ADMIN_SECRET ?? "";
  if (!expected) return false;
  const supplied =
    req.headers.get("x-admin-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(supplied) && supplied === expected;
}

function siteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "http://localhost:3000";
}

function shape(rec: CreatorRecord) {
  return {
    ...rec,
    link: `${siteOrigin()}/c/${rec.code}`,
  };
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const rows = await listCreatorCodes();
    return NextResponse.json({
      creators: rows.map(shape),
      count: rows.length,
    });
  } catch (err) {
    console.error("referral/creators GET failed", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code : "";
  const creator_name =
    typeof body.creator_name === "string" ? body.creator_name : "";
  const owner_email =
    typeof body.owner_email === "string" ? body.owner_email : "";
  const commission_rate_raw = body.commission_rate;
  const commission_rate =
    typeof commission_rate_raw === "number"
      ? commission_rate_raw
      : typeof commission_rate_raw === "string"
        ? Number(commission_rate_raw)
        : NaN;

  if (!code || !creator_name || !owner_email) {
    return NextResponse.json(
      {
        error:
          "code, creator_name, and owner_email are required (commission_rate defaults to 30)",
      },
      { status: 400 }
    );
  }

  const rate = Number.isFinite(commission_rate) ? commission_rate : 30;

  try {
    const rec = await ensureCreatorCode({
      code,
      creator_name,
      owner_email,
      commission_rate: rate,
    });
    return NextResponse.json({ creator: shape(rec) }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    const status = /already taken|invalid|must be|required/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

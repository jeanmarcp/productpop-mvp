// app/api/referral/[code]/stats/route.ts
// Per-creator referral stats (PRE-69).
//
//   GET /api/referral/:code/stats
//
// Returns: { code, creator_name, link, clicks, signups, conversions,
//            total_revenue, total_commission, commission_rate, ... }
//
// Auth rules:
//   - No auth header: only the public-safe subset (clicks, signups,
//     conversions, total_revenue, total_commission) is returned. Creator
//     identity and commission rate are redacted.
//   - Header `x-creator-email: <owner_email>`: returns full payload IF the
//     email matches the code's owner_email. Otherwise 403.
//   - Header `x-admin-secret: <ADMIN_SECRET>`: returns full payload
//     for any code (CMO / admin view).
//
// We use the `creator_referral_stats` view from migration 0004 as the
// primary source. Conversions = paid referral_conversions only; pending
// and refunded rows are excluded from totals.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StatsRow = {
  code: string;
  creator_name: string | null;
  owner_email: string | null;
  commission_rate: number | null;
  clicks: number | string;
  signups: number | string;
  conversions: number | string;
  total_revenue: number | string;
  total_commission: number | string;
};

function siteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "http://localhost:3000";
}

function isAdmin(req: NextRequest): boolean {
  const expected = process.env.ADMIN_SECRET ?? "";
  if (!expected) return false;
  const supplied =
    req.headers.get("x-admin-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(supplied) && supplied === expected;
}

function creatorEmailFromRequest(req: NextRequest): string | null {
  const raw = req.headers.get("x-creator-email")?.trim().toLowerCase() ?? "";
  if (!raw) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;
  return raw;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const rawCode = (params.code ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(rawCode)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  const code = rawCode;

  const { rows } = await query<StatsRow>(
    `SELECT code, creator_name, owner_email,
            commission_rate::float AS commission_rate,
            clicks, signups, conversions, total_revenue, total_commission
       FROM creator_referral_stats
      WHERE code = $1
      LIMIT 1`,
    [code]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "code not found" }, { status: 404 });
  }
  const r = rows[0];
  const admin = isAdmin(req);
  const creatorEmail = creatorEmailFromRequest(req);
  const ownsCode =
    creatorEmail !== null &&
    r.owner_email !== null &&
    r.owner_email.toLowerCase() === creatorEmail;

  const link = `${siteOrigin()}/c/${r.code}`;

  // Always-public aggregates
  const publicPayload = {
    code: r.code,
    link,
    clicks: Number(r.clicks),
    signups: Number(r.signups),
    conversions: Number(r.conversions),
    total_revenue: Number(r.total_revenue),
    total_commission: Number(r.total_commission),
  };

  if (!admin && !ownsCode) {
    return NextResponse.json(publicPayload);
  }

  return NextResponse.json({
    ...publicPayload,
    creator_name: r.creator_name,
    owner_email: r.owner_email,
    commission_rate: r.commission_rate,
  });
}

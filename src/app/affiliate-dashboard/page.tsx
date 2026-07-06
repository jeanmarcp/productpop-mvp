// app/affiliate-dashboard/page.tsx
// Minimal server-rendered affiliate dashboard. CMO uses this to inspect
// per-creator referral stats. No fancy UI — the spec is "can be a simple
// HTML page". Admin auth via the `?secret=...` query string, which is
// adequate for an internal-only tool. The same secret protects
// /api/referral/creators (ADMIN_SECRET env var).
//
// Each creator card shows: code, link, clicks, signups, conversions,
// total revenue, commission earned, commission rate.

import { listCreatorCodes } from "@/lib/referral";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Stats = {
  code: string;
  creator_name: string | null;
  owner_email: string | null;
  commission_rate: number | null;
  clicks: number;
  signups: number;
  conversions: number;
  total_revenue: number;
  total_commission: number;
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function fmtMoney(n: number): string {
  return `$${fmt(n)}`;
}

export default async function AffiliateDashboard({
  searchParams,
}: {
  searchParams: { secret?: string };
}) {
  const expected = process.env.ADMIN_SECRET ?? "";
  const suppliedRaw = searchParams?.secret;
  const supplied = (suppliedRaw ?? "").trim();
  const isAdmin = expected.length > 0 && supplied === expected;

  if (!isAdmin) {
    return (
      <main style={{ padding: 32, fontFamily: "ui-sans-serif, system-ui" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Affiliate dashboard</h1>
        <p style={{ color: "#666" }}>
          Access denied. Append <code>?secret=&lt;ADMIN_SECRET&gt;</code> to
          view this page.
        </p>
      </main>
    );
  }

  const creators = await listCreatorCodes();
  let statsByCode: Record<string, Stats> = {};
  if (creators.length > 0) {
    const { rows } = await query<Stats>(
      `SELECT code, creator_name, owner_email,
              commission_rate::float AS commission_rate,
              clicks, signups, conversions,
              total_revenue, total_commission
         FROM creator_referral_stats
        WHERE code = ANY($1)`,
      [creators.map((c) => c.code)]
    );
    for (const r of rows) {
      statsByCode[r.code] = {
        ...r,
        clicks: Number(r.clicks),
        signups: Number(r.signups),
        conversions: Number(r.conversions),
        total_revenue: Number(r.total_revenue),
        total_commission: Number(r.total_commission),
      };
    }
  }

  const totals = creators.reduce(
    (acc, c) => {
      const s = statsByCode[c.code];
      if (!s) return acc;
      acc.clicks += s.clicks;
      acc.signups += s.signups;
      acc.conversions += s.conversions;
      acc.total_revenue += s.total_revenue;
      acc.total_commission += s.total_commission;
      return acc;
    },
    { clicks: 0, signups: 0, conversions: 0, total_revenue: 0, total_commission: 0 }
  );

  const siteOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")
    .replace(/\/+$/, "");

  return (
    <main style={{ padding: 32, fontFamily: "ui-sans-serif, system-ui", maxWidth: 1080, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        Affiliate dashboard
      </h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Per-creator referral codes (PRE-69). Live numbers update from
        referral_attributions + referral_conversions.
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 12,
          margin: "20px 0 28px",
        }}
      >
        {[
          ["Clicks", totals.clicks],
          ["Signups", totals.signups],
          ["Conversions", totals.conversions],
          ["Revenue", fmtMoney(totals.total_revenue)],
          ["Commission", fmtMoney(totals.total_commission)],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              padding: 14,
              border: "1px solid #e5e7eb",
              borderRadius: 10,
            }}
          >
            <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{String(value)}</div>
          </div>
        ))}
      </section>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
            <th style={{ padding: "8px 6px" }}>Creator</th>
            <th style={{ padding: "8px 6px" }}>Code</th>
            <th style={{ padding: "8px 6px" }}>Rate</th>
            <th style={{ padding: "8px 6px", textAlign: "right" }}>Clicks</th>
            <th style={{ padding: "8px 6px", textAlign: "right" }}>Signups</th>
            <th style={{ padding: "8px 6px", textAlign: "right" }}>Conv.</th>
            <th style={{ padding: "8px 6px", textAlign: "right" }}>Revenue</th>
            <th style={{ padding: "8px 6px", textAlign: "right" }}>Commission</th>
          </tr>
        </thead>
        <tbody>
          {creators.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: 16, color: "#6b7280" }}>
                No creator codes yet. POST to{" "}
                <code>/api/referral/creators</code> to create one.
              </td>
            </tr>
          ) : (
            creators.map((c) => {
              const s = statsByCode[c.code];
              return (
                <tr key={c.code} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px 6px" }}>
                    <div style={{ fontWeight: 600 }}>{c.creator_name}</div>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>
                      {c.owner_email}
                    </div>
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    <code>{c.code}</code>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>
                      {siteOrigin}/c/{c.code}
                    </div>
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {c.commission_rate}%
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>
                    {s ? fmt(s.clicks) : "0"}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>
                    {s ? fmt(s.signups) : "0"}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>
                    {s ? fmt(s.conversions) : "0"}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>
                    {s ? fmtMoney(s.total_revenue) : "$0"}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>
                    {s ? fmtMoney(s.total_commission) : "$0"}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </main>
  );
}

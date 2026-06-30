// app/api/email/[id]/route.ts
// Render an email template by id. The marketing email worker calls
// this with vars to get the rendered subject/html/text payload.
// Also returns a preview path so CMO can eyeball templates in the
// browser without a send.
//
// POST /api/email/referral-intro
//   body: { email, vars: { firstName?, referralCode, referralLink, ... } }
//   -> { templateId, to, subject, html, text }

import { NextRequest, NextResponse } from "next/server";
import {
  listTemplateIds,
  renderTemplate,
  type EmailVars,
} from "@/lib/email-templates";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  if (id === "" || id === "_all") {
    return NextResponse.json({ templates: listTemplateIds() });
  }
  const t = renderTemplate(id, {});
  if (!t) {
    return NextResponse.json(
      { error: `Unknown template: ${id}` },
      { status: 404 }
    );
  }
  return NextResponse.json({ templateId: id, ...t });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  let body: { email?: string; vars?: EmailVars; enqueue?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const to = (body?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(to)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const rendered = renderTemplate(id, body?.vars ?? {});
  if (!rendered) {
    return NextResponse.json(
      { error: `Unknown template: ${id}` },
      { status: 404 }
    );
  }

  // Always log to the events table so the CMO can see what would be sent.
  try {
    await query(
      `INSERT INTO events (kind, email, payload) VALUES ($1, $2, $3::jsonb)`,
      [
        `email_render:${id}`,
        to,
        JSON.stringify({
          to,
          subject: rendered.subject,
          vars: body?.vars ?? {},
        }),
      ]
    );
  } catch (err) {
    console.warn("email render log failed (non-fatal)", err);
  }

  // If the caller asked us to enqueue, store a record in the events
  // table the worker can drain. We keep it inside `events` (not a new
  // table) so we don't bloat the schema; the worker filters on kind.
  if (body?.enqueue) {
    try {
      await query(
        `INSERT INTO events (kind, email, payload) VALUES ($1, $2, $3::jsonb)`,
        [
          `email_send:${id}`,
          to,
          JSON.stringify({
            to,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            vars: body?.vars ?? {},
          }),
        ]
      );
    } catch (err) {
      console.warn("email enqueue failed (non-fatal)", err);
    }
  }

  return NextResponse.json({
    templateId: id,
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
}

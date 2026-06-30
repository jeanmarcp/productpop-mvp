// app/api/remove-bg/route.ts
// POST { imageBase64, email? } -> 200 { ok, outputBase64 } | 400 bad input | 502 upstream
//
// Uses remove.bg REST API. In dev (REMOVE_BG_MOCK=1) it just echoes the
// input as output so the UI flow can be exercised without a paid key.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED = /^data:image\/(png|jpe?g|webp|heic|heif);base64,/i;

export async function POST(req: NextRequest) {
  let body: { imageBase64?: string; email?: string };
  try {
    body = (await req.json()) as { imageBase64?: string; email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = body?.imageBase64;
  if (typeof raw !== "string" || raw.length === 0) {
    return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
  }
  if (raw.length > MAX_BYTES * 2) {
    return NextResponse.json(
      { error: "Image too large (10MB max)" },
      { status: 400 }
    );
  }
  if (ALLOWED.test(raw) === false && !/^[A-Za-z0-9+/=]+$/.test(raw)) {
    return NextResponse.json(
      { error: "Unsupported image format" },
      { status: 400 }
    );
  }

  const cleanEmail =
    typeof body?.email === "string" && body.email.trim().length > 0
      ? body.email.trim().toLowerCase()
      : null;

  const apiKey = process.env.REMOVEBG_API_KEY;
  const isMock = process.env.REMOVE_BG_MOCK === "1" || !apiKey;

  let outputBase64: string;
  let usedMock = false;

  if (isMock) {
    // Dev path: pass the input through unchanged so the UI flow works.
    usedMock = true;
    outputBase64 = raw.replace(/^data:image\/[a-z]+;base64,/i, "");
  } else {
    // Real path: forward to remove.bg
    const form = new FormData();
    const bytes = Uint8Array.from(
      atob(raw.replace(/^data:image\/[a-z]+;base64,/i, "")),
      (c) => c.charCodeAt(0)
    );
    const blob = new Blob([bytes], { type: "image/png" });
    form.append("image_file", blob, "upload.png");
    form.append("size", "auto");

    const upstream = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: form,
    });
    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error("remove.bg failed", upstream.status, errText.slice(0, 200));
      return NextResponse.json(
        { error: "Background-removal service error" },
        { status: 502 }
      );
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    outputBase64 = buf.toString("base64");
  }

  // Persist (best-effort; do not fail the request on a DB error here).
  try {
    await query(
      `INSERT INTO edits (email, input_url, output_url, source) VALUES ($1, $2, $3, $4)`,
      [
        cleanEmail,
        "inline://input",
        usedMock ? "inline://mock-output" : "inline://removebg-output",
        "upload",
      ]
    );
  } catch (err) {
    console.warn("edits insert failed (non-fatal)", err);
  }

  return NextResponse.json({
    ok: true,
    outputBase64: `data:image/png;base64,${outputBase64}`,
    mocked: usedMock,
  });
}

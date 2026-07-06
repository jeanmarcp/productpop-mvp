// app/api/testimonials/video/[id]/route.ts
//
// Stream a seller video from `assets/testimonials/video/<id>.<ext>`.
//
// This route is referenced by the testimonials loader (lib/testimonials.ts).
// We never inline binary assets into the bundle; the page points at this URL
// and Next streams the file with proper content-type + caching headers.
//
// Security: path is whitelisted to the testimonials/video directory. We
// never trust a user-supplied path component — the route only takes the
// seller id and resolves to known extensions on disk.

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, statSync, existsSync } from "node:fs";
import { join, resolve, basename, extname } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIDEO_DIR = resolve(process.cwd(), "assets", "testimonials", "video");
const ALLOWED_EXTS = new Map<string, string>([
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".mov", "video/quicktime"],
]);

// Slug shape: letters, digits, dashes, underscores. We deliberately do not
// allow slashes or dots in the id segment so a request like
// /api/testimonials/video/..%2F..%2Fetc-passwd is rejected before disk I/O.
const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = params.id;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Find any matching extension on disk.
  for (const [ext, contentType] of ALLOWED_EXTS) {
    const candidate = join(VIDEO_DIR, `${id}${ext}`);
    if (existsSync(candidate)) {
      const stat = statSync(candidate);
      if (!stat.isFile()) continue;
      const buf = readFileSync(candidate);
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(stat.size),
          // Cache at the CDN for a day; allow stale-while-revalidate for a week.
          "Cache-Control":
            "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          // Defense in depth: never let the browser try to sniff another type.
          "X-Content-Type-Options": "nosniff",
          "Content-Disposition": `inline; filename="${basename(candidate)}"`,
        },
      });
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

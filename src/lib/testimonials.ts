// Testimonials loader for the V2-D2 landing page.
//
// Source of truth: `assets/testimonials/` in the repo root.
// - `text/<seller_id>.md`  — written testimonials, front-matter + body
// - `video/<seller_id>.<ext>` — raw seller video uploads
// - `video/<seller_id>.json` — sibling sidecar (posterUrl, transcript, durationSec)
// - `manifest.json`          — Engineer-generated index; takes priority when present
//
// Contract for Engineer (see assets/testimonials/README.md):
//   The Engineer (`d77e6ac0`, PRO-97 poller) writes these files at build time
//   (cron 09:00 + on every new reply). We read them synchronously on the server
//   so the page renders real data on the first paint — no client-side fetch.
//
// Run model: this module is imported from a Server Component (page.tsx), so
// `fs.readdirSync` is fine. The Next.js bundler does not try to inline these
// files — they are read at runtime from the deployed repo working dir.
//
// Failure mode: if the directory is missing or empty, we return an empty
// testimonials array. The page renders honest-pending placeholders in that
// case. We never throw on missing assets — launch must not break if a real
// seller reply hasn't landed yet.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, extname, basename } from "node:path";

export type LoadedTestimonial =
  | {
      id: string;
      kind: "written";
      quote: string;
      name: string;
      business: string;
      avatarUrl?: string;
      createdAt?: string;
      source: "text";
    }
  | {
      id: string;
      kind: "video";
      name: string;
      business: string;
      videoUrl: string;
      posterUrl?: string;
      transcript?: string;
      durationSec?: number;
      source: "video";
    };

const REPO_ROOT = resolve(process.cwd());
const ASSETS_DIR = join(REPO_ROOT, "assets", "testimonials");
const TEXT_DIR = join(ASSETS_DIR, "text");
const VIDEO_DIR = join(ASSETS_DIR, "video");
const MANIFEST_PATH = join(ASSETS_DIR, "manifest.json");

/**
 * Read all testimonials currently in `assets/testimonials/`.
 *
 * Order:
 *   1. If `manifest.json` exists, use it as the authoritative index and
 *      resolve each entry against the on-disk file. This is the Engineer's
 *      contract (PRO-97 poller writes the manifest after every reply).
 *   2. Otherwise, fall back to a defensive directory scan. Same shape, so
 *      callers don't need to branch.
 *
 * The function is safe to call when the directories are empty or missing:
 * it returns `[]` and lets the UI render the honest-pending state.
 */
export function loadTestimonials(): LoadedTestimonial[] {
  if (!existsSync(ASSETS_DIR)) return [];

  if (existsSync(MANIFEST_PATH)) {
    try {
      const raw = readFileSync(MANIFEST_PATH, "utf8");
      const parsed = JSON.parse(raw) as ManifestShape;
      return fromManifest(parsed);
    } catch (err) {
      // Malformed manifest should never break the build. Fall through to
      // directory scan and let the Engineer see the warning in their logs.
      console.warn(
        "[testimonials] manifest.json is malformed, falling back to dir scan:",
        err,
      );
    }
  }

  return [
    ...scanTextDir(),
    ...scanVideoDir(),
  ];
}

// --- Manifest contract -----------------------------------------------------

type ManifestShape = {
  /** Schema version. Bump when the shape changes. */
  version: number;
  written: {
    /** Stable id (matches `text/<id>.md`). */
    id: string;
    /** Path relative to repo root, e.g. "assets/testimonials/text/lisa-anderson.md". */
    path: string;
    /** Optional pre-parsed quote; loader re-parses from `path` for ground truth. */
    quote?: string;
    name?: string;
    business?: string;
    avatarUrl?: string;
    createdAt?: string;
  }[];
  video: {
    id: string;
    /** Path to the video file relative to repo root. */
    path: string;
    /** Optional sibling sidecar JSON path. */
    sidecar?: string;
    name?: string;
    business?: string;
    posterUrl?: string;
    durationSec?: number;
  }[];
};

function fromManifest(m: ManifestShape): LoadedTestimonial[] {
  const out: LoadedTestimonial[] = [];
  for (const w of m.written ?? []) {
    const parsed = parseWrittenFile(join(REPO_ROOT, w.path));
    if (parsed) out.push(parsed);
  }
  for (const v of m.video ?? []) {
    const parsed = parseVideoEntry(v, join(REPO_ROOT, v.path));
    if (parsed) out.push(parsed);
  }
  return out;
}

// --- Directory-scan fallback (no manifest) ---------------------------------

function scanTextDir(): LoadedTestimonial[] {
  if (!existsSync(TEXT_DIR)) return [];
  const out: LoadedTestimonial[] = [];
  for (const file of readdirSync(TEXT_DIR)) {
    if (!file.endsWith(".md")) continue;
    const parsed = parseWrittenFile(join(TEXT_DIR, file));
    if (parsed) out.push(parsed);
  }
  return out;
}

function scanVideoDir(): LoadedTestimonial[] {
  if (!existsSync(VIDEO_DIR)) return [];
  const out: LoadedTestimonial[] = [];
  for (const file of readdirSync(VIDEO_DIR)) {
    const ext = extname(file).toLowerCase();
    if (!VIDEO_EXTS.has(ext)) continue;
    const id = basename(file, ext);
    const parsed = parseVideoEntry(
      { id, path: join("assets", "testimonials", "video", file) },
      join(VIDEO_DIR, file),
    );
    if (parsed) out.push(parsed);
  }
  return out;
}

const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov"]);

// --- Parsers ---------------------------------------------------------------

/**
 * Parse a `text/<id>.md` file. Format:
 *
 *     ---
 *     id: lisa-anderson
 *     name: Lisa Anderson
 *     business: Anderson Vintage (@email.com)
 *     avatarUrl: /avatars/lisa.jpg
 *     createdAt: 2026-07-08
 *     ---
 *
 *     The actual testimonial body. One short paragraph.
 *
 * The first front-matter block is the source of truth. The body is what we
 * show as the quote (no separate `quote:` field needed).
 */
function parseWrittenFile(absPath: string): LoadedTestimonial | null {
  if (!existsSync(absPath)) return null;
  const raw = readFileSync(absPath, "utf8");
  const { meta, body } = splitFrontMatter(raw);
  if (!meta.id) return null;
  const quote = (body ?? "").trim();
  if (!quote) return null;
  return {
    id: meta.id,
    kind: "written",
    quote,
    name: meta.name ?? "",
    business: meta.business ?? "",
    avatarUrl: meta.avatarUrl || undefined,
    createdAt: meta.createdAt || undefined,
    source: "text",
  };
}

function parseVideoEntry(
  entry: {
    id: string;
    path?: string;
    name?: string;
    business?: string;
    posterUrl?: string;
    sidecar?: string;
    durationSec?: number;
  },
  absVideoPath: string,
): LoadedTestimonial | null {
  if (!existsSync(absVideoPath)) return null;

  // Sidecar JSON sits next to the video with the same id. It carries
  // posterUrl + transcript + duration. The poster URL is REQUIRED for the
  // V2-D2 card (a video card with no poster is just a black box).
  const ext = extname(absVideoPath);
  const id = basename(absVideoPath, ext);
  const sidecarPath = entry.sidecar
    ? join(REPO_ROOT, entry.sidecar)
    : join(VIDEO_DIR, `${id}.json`);

  let transcript: string | undefined;
  let posterUrl = entry.posterUrl;
  let durationSec = entry.durationSec;
  if (existsSync(sidecarPath)) {
    try {
      const sidecar = JSON.parse(readFileSync(sidecarPath, "utf8")) as {
        posterUrl?: string;
        transcript?: string;
        durationSec?: number;
        name?: string;
        business?: string;
      };
      posterUrl = posterUrl ?? sidecar.posterUrl;
      transcript = sidecar.transcript;
      durationSec = durationSec ?? sidecar.durationSec;
      entry.name = entry.name ?? sidecar.name;
      entry.business = entry.business ?? sidecar.business;
    } catch {
      // Ignore malformed sidecar; the video still renders.
    }
  }

  return {
    id,
    kind: "video",
    name: entry.name ?? "",
    business: entry.business ?? "",
    videoUrl: `/api/testimonials/video/${id}${ext}`,
    posterUrl: posterUrl || undefined,
    transcript,
    durationSec,
    source: "video",
  };
}

// --- Front-matter helpers --------------------------------------------------

function splitFrontMatter(raw: string): {
  meta: Record<string, string>;
  body: string;
} {
  const meta: Record<string, string> = {};
  // Front-matter must start on line 1.
  if (!raw.startsWith("---")) return { meta, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { meta, body: raw };
  const fm = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\n/, "");
  for (const line of fm.split("\n")) {
    const m = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    meta[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return { meta, body };
}

// --- Diagnostics (handy in dev / CI) ---------------------------------------

/**
 * Return a tiny count object. Used by the engineer's health check and by the
 * pending-note copy on the page (e.g. "0/10 written, 0/3 video").
 */
export function testimonialCounts(): {
  written: number;
  video: number;
  total: number;
} {
  const all = loadTestimonials();
  const written = all.filter((t) => t.kind === "written").length;
  const video = all.filter((t) => t.kind === "video").length;
  return { written, video, total: written + video };
}

// Quietly silence unused-import lints if any helper is dropped later.
void statSync;

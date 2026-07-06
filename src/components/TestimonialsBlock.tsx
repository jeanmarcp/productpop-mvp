// Testimonials block for V2-D2 (VOIA-51 / PRO-99).
//
// Design intent (extending PRO-95 prior art):
// - 2 testimonial cards side by side on desktop, stacked on mobile.
// - Each empty slot renders an honest "pending" state with a `Pending` badge
//   and its own `Add your story` mailto CTA. We do NOT use a third CTA card.
//   No fake testimonials. No Lorem. No "John Doe" placeholders that read like
//   real quotes. The honest-pending card is the design.
// - When `assets/testimonials/{text,video}/` is non-empty, real testimonials
//   auto-populate the first N slots. The 2-slot grid is the cap.
// - 1-slot fallback: if there is 1 real testimonial and 1 empty slot, the
//   empty slot stays in pending-with-CTA state (not a duplicate of slot 1).
// - One toggle, `testimonialsMode = "active" | "collapsed"`, hides the entire
//   section. The Option-D collapse branch (no testimonials at launch).
// - The CTA mailto opens the user's mail client with subject
//   "ProductPop testimonial — V2-D2" and a one-line prompt in the body.
//
// Data shape:
// - `Testimonial.kind` = "written" | "video" (real) | "pending" (empty slot).
// - "pending" is the default for any missing slot. We never write a fake
//   quote into it; the card just shows the badge + CTA + a short honest line
//   of copy ("We're collecting seller stories now — check back this week.").

import { Card, Eyebrow, H2, Section } from "./ui";
import { type ReactNode } from "react";

export type Testimonial =
  | {
      id: string;
      kind: "written";
      quote: string;
      name: string;
      business: string;
      avatarUrl?: string;
    }
  | {
      id: string;
      kind: "video";
      name: string;
      business: string;
      videoUrl: string;
      posterUrl?: string;
      transcript?: string;
    }
  | {
      id: string;
      kind: "pending";
      /** Pre-baked honest copy. Kept generic on purpose. */
      reason?: string;
    };

export type TestimonialsBlockProps = {
  /** Up to 2 testimonials. The grid caps at 2 cards. */
  testimonials: Testimonial[];
  /** Inbound email for the per-card "Add your story" CTA. */
  addYourStoryEmail: string;
  /**
   * "active"    — render the 2-slot grid (default).
   * "collapsed" — render nothing. Option-D escape hatch when the user/board
   *               decides to ship without testimonials (2026-07-09 trigger).
   */
  testimonialsMode?: "active" | "collapsed";
};

const MAILTO_SUBJECT = "ProductPop testimonial — V2-D2";
const MAILTO_BODY =
  "Tell us in 2-3 sentences what ProductPop did for your listing photos. A photo of your product helps.";
const PENDING_REASON = "We're collecting seller stories now — check back this week.";
const MAX_REAL = 2;

function buildMailtoHref(email: string): string {
  // encodeURIComponent handles the subject + body safely; spaces, newlines,
  // and the em-dash all round-trip. Most mail clients treat `\n` as a line
  // break, but per RFC 6068 the canonical form is `%0A` — encodeURIComponent
  // already emits that, so we are spec-compliant.
  const subject = encodeURIComponent(MAILTO_SUBJECT);
  const body = encodeURIComponent(MAILTO_BODY);
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

function PendingCard({ email, reason }: { email: string; reason?: string }): ReactNode {
  return (
    <Card
      className="flex h-full flex-col border-dashed border-zinc-300 bg-zinc-50/60"
      data-testid="testimonial-pending-slot"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700"
        >
          ⏳
        </span>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
          Pending
        </span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-zinc-700">
        {reason ?? PENDING_REASON}
      </p>
      <div className="mt-5 flex-1" aria-hidden="true" />
      <a
        className="mt-5 inline-flex items-center gap-2 self-start rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-700"
        href={buildMailtoHref(email)}
        data-testid="testimonial-cta-add-your-story"
      >
        Add your story →
      </a>
      <p className="mt-3 text-[11px] text-zinc-500">
        No real name on file yet. We&apos;d rather show &ldquo;pending&rdquo; than a fake one.
      </p>
    </Card>
  );
}

function WrittenCard({ t }: { t: Extract<Testimonial, { kind: "written" }> }): ReactNode {
  return (
    <Card className="flex h-full flex-col" data-testid={`testimonial-real-${t.id}`}>
      <blockquote className="text-sm leading-relaxed text-zinc-700">
        &ldquo;{t.quote}&rdquo;
      </blockquote>
      <div className="mt-5 flex items-center gap-3">
        {t.avatarUrl ? (
          // Real seller avatar only. No initials fallback (would be fake).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.avatarUrl}
            alt={`${t.name} avatar`}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <span aria-hidden="true" className="h-9 w-9 rounded-full bg-zinc-200" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900">{t.name}</p>
          <p className="truncate text-xs text-zinc-500">{t.business}</p>
        </div>
      </div>
    </Card>
  );
}

function VideoCard({ t }: { t: Extract<Testimonial, { kind: "video" }> }): ReactNode {
  // A video card without a poster would render as a black box. The loader
  // guarantees posterUrl is set when a video is shipped; if not, we fall
  // back to a clearly-labelled placeholder so the page never looks broken.
  return (
    <Card
      className="flex h-full flex-col"
      data-testid={`testimonial-real-video-${t.id}`}
    >
      <div className="overflow-hidden rounded-xl bg-zinc-100">
        {t.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <video
            className="aspect-video w-full object-cover"
            controls
            preload="metadata"
            playsInline
            poster={t.posterUrl}
            aria-label={`${t.name} testimonial video`}
          >
            <source src={t.videoUrl} />
            {t.transcript ? (
              <track
                kind="captions"
                srcLang="en"
                label="English"
                default
              />
            ) : null}
            Your browser does not support embedded video.{" "}
            <a className="underline" href={t.videoUrl}>
              Download the file
            </a>
            .
          </video>
        ) : (
          <div
            className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 text-xs font-medium text-zinc-500"
            aria-label="Video poster not yet available"
          >
            Video poster pending
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span aria-hidden="true" className="h-9 w-9 rounded-full bg-pink-100" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900">{t.name}</p>
          <p className="truncate text-xs text-zinc-500">{t.business}</p>
        </div>
      </div>
    </Card>
  );
}

function TestimonialCard({ t, email }: { t: Testimonial; email: string }): ReactNode {
  if (t.kind === "pending") return <PendingCard email={email} reason={t.reason} />;
  if (t.kind === "video") return <VideoCard t={t} />;
  return <WrittenCard t={t} />;
}

/**
 * V2-D2 Testimonials block.
 *
 * One toggle (`testimonialsMode`) controls the entire section:
 *   - "active"    → 2-slot grid with honest-pending fallback per slot.
 *   - "collapsed" → render nothing (Option-D escape hatch).
 */
export function TestimonialsBlock({
  testimonials,
  addYourStoryEmail,
  testimonialsMode = "active",
}: TestimonialsBlockProps): ReactNode {
  if (testimonialsMode === "collapsed") return null;

  // Cap the grid at 2 cards. Real testimonials first, then fill with pending
  // slots so a single real + 1 empty still renders two honest cards (1-slot
  // fallback per spec).
  const real = testimonials.filter((t) => t.kind !== "pending").slice(0, MAX_REAL);
  const slots: Testimonial[] = [...real];
  while (slots.length < MAX_REAL) {
    slots.push({
      id: `pending-${slots.length + 1}`,
      kind: "pending",
      reason: PENDING_REASON,
    });
  }

  return (
    <Section data-testid="testimonials-block">
      <Eyebrow>What sellers say</Eyebrow>
      <H2>Real sellers, real numbers.</H2>
      <p
        className="mt-4 max-w-2xl text-sm text-zinc-600"
        data-testid="testimonials-pending-note"
      >
        {real.length === 0
          ? "Pending slots. We're collecting seller stories now — check back this week."
          : real.length === 1
            ? "One story in. The next slot will fill as replies come in — every empty card has its own add-your-story link."
            : "Real replies from the founder-network outreach. Pending slots still accept new stories."}
      </p>
      <div
        className="mt-10 grid gap-5 sm:grid-cols-2"
        data-testid="testimonials-grid"
      >
        {slots.map((t) => (
          <TestimonialCard key={t.id} t={t} email={addYourStoryEmail} />
        ))}
      </div>
    </Section>
  );
}

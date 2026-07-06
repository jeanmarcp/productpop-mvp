// Testimonials block for V2-D2 (VOIA-51).
//
// Design intent (from PRO-98):
// - 2 testimonial cards side by side on desktop, stacked on mobile.
// - "Add your story" CTA card as the third slot (mailto: jeanmarc.pedron@gmail.com).
// - Pending placeholder copy + "Pending" badge until a real reply lands.
//   NOT a fake name. NOT a stock photo. NOT an illustrative composite.
// - Option D fallback: if the user/board chooses Option D (no testimonials at
//   launch), the section collapses to a single founder quote + 2 product
//   screenshot slots. That branch is driven by ONE prop (`useOptionD`) — the
//   "Skip-to-screenshots" layout is the same component, just with the
//   grid branch hidden. No separate rebuild.
//
// Data shape (Testimonial.kind):
// - "real"   : a confirmed seller reply. Shows name, business, optional avatar.
// - "pending": no real reply yet. Shows the "Pending" badge and skeleton lines.
//
// AddYourStoryCard is always rendered as the third grid slot (desktop) or
// last item (mobile stacked). It is the inbound path for future replies.

import { Card, Eyebrow, H2, Section } from "./ui";
import { type ReactNode } from "react";

export type Testimonial = {
  /** Stable slug. Used as the React key and as the source-of-truth filename. */
  id: string;
  kind: "real" | "pending";
  /** ≤240 chars. Required. */
  quote: string;
  /** Real seller's name. Empty string when kind === "pending". */
  name: string;
  /** Real business / shop / marketplace. Empty string when kind === "pending". */
  business: string;
  /** Optional. Real seller avatar URL. Leave empty if no real photo. */
  avatarUrl?: string;
};

export type FounderQuote = {
  quote: string;
  name: string;
  role: string;
  avatarUrl?: string;
};

export type ProductScreenshot = {
  /** Stable id for keying. */
  id: string;
  /** Caption shown under the screenshot slot. */
  caption: string;
  /**
   * Image URL. May be empty in V2-D2 — the slot will render a labelled
   * placeholder rectangle (a11y-correct) until Engineer drops the file.
   * NEVER an illustrative composite or a stock photo.
   */
  imageUrl?: string;
  alt: string;
};

export type TestimonialsBlockProps = {
  /** Testimonials to render in the 2-slot grid. Order is preserved. */
  testimonials: Testimonial[];
  /** Inbound email for the "Add your story" CTA card. */
  addYourStoryEmail: string;
  /**
   * Founder-quote + 2 product screenshots branch (Option D fallback).
   * When true, the 2-slot grid is hidden and the founder block is shown
   * instead. ONE prop. No separate rebuild.
   */
  useOptionD?: boolean;
  /** Founder quote + 2 screenshots. Required when useOptionD is true. */
  founderQuote?: FounderQuote;
  productScreenshots?: ProductScreenshot[];
};

const PENDING_BADGE = "Pending — first seller reply expected in 3–5 days";
const MAX_QUOTE = 240;

function clipQuote(q: string): string {
  if (q.length <= MAX_QUOTE) return q;
  return q.slice(0, MAX_QUOTE - 1).trimEnd() + "…";
}

function TestimonialCard({ t }: { t: Testimonial }): ReactNode {
  if (t.kind === "real") {
    return (
      <Card className="flex h-full flex-col" data-testid={`testimonial-real-${t.id}`}>
        <blockquote className="text-sm leading-relaxed text-zinc-700">
          &ldquo;{clipQuote(t.quote)}&rdquo;
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
            <span
              aria-hidden="true"
              className="h-9 w-9 rounded-full bg-zinc-200"
            />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900">
              {t.name}
            </p>
            <p className="truncate text-xs text-zinc-500">{t.business}</p>
          </div>
        </div>
      </Card>
    );
  }

  // kind === "pending"
  return (
    <Card
      className="flex h-full flex-col border-dashed border-zinc-300 bg-zinc-50/60"
      data-testid={`testimonial-pending-${t.id}`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700"
        >
          ⏳
        </span>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
          {PENDING_BADGE}
        </span>
      </div>
      <blockquote className="mt-4 text-sm leading-relaxed text-zinc-700">
        &ldquo;{clipQuote(t.quote)}&rdquo;
      </blockquote>
      <div className="mt-5 space-y-1.5">
        <div className="h-3 w-40 rounded bg-zinc-200" aria-hidden="true" />
        <div className="h-2.5 w-28 rounded bg-zinc-200" aria-hidden="true" />
      </div>
      <p className="mt-3 text-[11px] text-zinc-500">
        No real name on file yet. The badge is the entire point — we&apos;d
        rather show &ldquo;pending&rdquo; than a fake one.
      </p>
    </Card>
  );
}

function AddYourStoryCard({ email }: { email: string }): ReactNode {
  return (
    <Card
      className="flex h-full flex-col items-start justify-between border-pink-200 bg-pink-50/50"
      data-testid="testimonial-add-your-story"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-600">
          Add your story
        </p>
        <h3 className="mt-2 text-lg font-semibold text-zinc-900">
          Selling with ProductPop? We&apos;d love to hear from you.
        </h3>
        <p className="mt-2 text-sm text-zinc-700">
          One short quote, your first name, and your shop is enough. We&apos;ll
          handle the rest.
        </p>
      </div>
      <a
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-700"
        href={`mailto:${email}?subject=ProductPop%20testimonial`}
      >
        Share your story →
      </a>
    </Card>
  );
}

function FounderQuoteBlock({
  founder,
  screenshots,
}: {
  founder: FounderQuote;
  screenshots: ProductScreenshot[];
}): ReactNode {
  return (
    <div
      className="mt-10 grid gap-8 lg:grid-cols-5"
      data-testid="testimonials-option-d"
    >
      <Card className="lg:col-span-3">
        <Eyebrow>From the founder</Eyebrow>
        <blockquote className="mt-3 text-lg leading-relaxed text-zinc-800">
          &ldquo;{founder.quote}&rdquo;
        </blockquote>
        <div className="mt-5 flex items-center gap-3">
          {founder.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={founder.avatarUrl}
              alt={`${founder.name} avatar`}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="h-10 w-10 rounded-full bg-zinc-200"
            />
          )}
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              {founder.name}
            </p>
            <p className="text-xs text-zinc-500">{founder.role}</p>
          </div>
        </div>
      </Card>
      <div className="grid gap-5 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
        {screenshots.map((s) => (
          <figure
            key={s.id}
            className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
            data-testid={`screenshot-slot-${s.id}`}
          >
            {s.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.imageUrl}
                alt={s.alt}
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div
                className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 text-xs font-medium text-zinc-500"
                aria-label={s.alt}
              >
                Screenshot slot
              </div>
            )}
            <figcaption className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              {s.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

/**
 * V2-D2 Testimonials block.
 *
 * Toggle behaviour: pass `useOptionD` to swap the 2-slot grid for the
 * founder-quote + screenshots branch. No CSS class juggling, no separate
 * rebuild — same component, one prop.
 */
export function TestimonialsBlock({
  testimonials,
  addYourStoryEmail,
  useOptionD = false,
  founderQuote,
  productScreenshots = [],
}: TestimonialsBlockProps): ReactNode {
  return (
    <Section>
      <Eyebrow>What sellers say</Eyebrow>
      <H2>
        {useOptionD
          ? "Built for sellers, not designers."
          : "Real sellers, real numbers."}
      </H2>

      {useOptionD ? (
        founderQuote ? (
          <FounderQuoteBlock
            founder={founderQuote}
            screenshots={productScreenshots}
          />
        ) : (
          <p className="mt-8 text-sm text-zinc-500">
            Founder quote not configured.
          </p>
        )
      ) : (
        <>
          <p
            className="mt-4 max-w-2xl text-sm text-zinc-600"
            data-testid="testimonials-pending-note"
          >
            Pending slots. We&apos;re collecting the first round of seller
            replies through a short founder-network outreach — replies expected
            in 3–5 days. We&apos;d rather show &ldquo;pending&rdquo; than a
            fake name.
          </p>
          <div
            className="mt-10 grid gap-5 sm:grid-cols-2"
            data-testid="testimonials-grid"
          >
            {testimonials.slice(0, 2).map((t) => (
              <TestimonialCard key={t.id} t={t} />
            ))}
            <div className="sm:col-span-2">
              <AddYourStoryCard email={addYourStoryEmail} />
            </div>
          </div>
        </>
      )}
    </Section>
  );
}

"use client";

// Hero — client island that renders the hero headline, subhead, value
// points and the two CTAs ("Try it now" -> scrolls to #try,
// "Join waitlist" -> opens the email modal).
//
// Kept as a client component so the "Join waitlist" button can toggle
// the modal state without a full page round-trip. The uploader itself
// remains a separate island mounted in the right column of the hero.

import { useState } from "react";
import WaitlistModal from "./WaitlistModal";

type Props = {
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
};

export default function HeroCtas({ primaryCta, secondaryCta }: Props) {
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  return (
    <>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <a
          href={primaryCta.href}
          className="inline-flex items-center justify-center rounded-full bg-pink-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2"
        >
          {primaryCta.label}
        </a>
        <button
          type="button"
          onClick={() => setWaitlistOpen(true)}
          className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2"
        >
          {secondaryCta.label}
        </button>
      </div>
      <WaitlistModal open={waitlistOpen} onClose={() => setWaitlistOpen(false)} />
    </>
  );
}

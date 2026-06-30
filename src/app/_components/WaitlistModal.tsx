"use client";

// WaitlistModal — minimal modal triggered by the "Join waitlist" CTA.
// Renders an email input that posts to /api/waitlist and shows the
// referral code on success. Closes on backdrop click or Escape.
//
// Lives in /_components (private) so it doesn't get its own route.

import { useEffect, useRef, useState } from "react";
import WaitlistForm from "./WaitlistForm";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function WaitlistModal({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    // Lock background scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/50 p-3 sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-zinc-200"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-pink-600">
              ProductPop · Waitlist
            </p>
            <h2
              id="waitlist-modal-title"
              className="mt-2 text-2xl font-bold tracking-tight text-zinc-900"
            >
              Get early access
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Drop your email and we&apos;ll save your spot. We&apos;ll let you know as
              soon as new features and platform exports go live.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close waitlist dialog"
            className="-mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ×
            </span>
          </button>
        </div>
        <div className="mt-5">
          <WaitlistForm />
        </div>
      </div>
    </div>
  );
}

// app/_components/WaitlistForm.tsx
// Client-side waitlist form. Submits to /api/waitlist, then swaps in
// the share view with the user's unique referral link.

"use client";

import { useState } from "react";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok"; email: string; code: string; link: string }
  | { kind: "duplicate"; email: string; code: string | null; link: string | null }
  | { kind: "error"; message: string };

type Props = {
  prefilledRef?: string | null;
};

export default function WaitlistForm({ prefilledRef }: Props) {
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status.kind === "submitting") return;
    setStatus({ kind: "submitting" });
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: "landing" }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        referralCode?: string;
        error?: string;
      };
      if (r.status === 409) {
        // Already on the list — fetch their existing code if we can.
        let code: string | null = null;
        let link: string | null = null;
        try {
          const me = await fetch(
            `/api/referral/me?email=${encodeURIComponent(email.trim().toLowerCase())}`
          );
          if (me.ok) {
            const meData = (await me.json()) as {
              code?: string;
              link?: string;
            };
            code = meData.code ?? null;
            link = meData.link ?? null;
          }
        } catch {
          /* non-fatal */
        }
        setStatus({ kind: "duplicate", email, code, link });
        return;
      }
      if (!r.ok || !data.ok || !data.referralCode) {
        setStatus({
          kind: "error",
          message: data.error ?? "Something went wrong, please retry.",
        });
        return;
      }
      const link = `${window.location.origin}/r/${data.referralCode}`;
      setStatus({
        kind: "ok",
        email,
        code: data.referralCode,
        link,
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: (err as Error).message ?? "Network error",
      });
    }
  }

  async function copyLink() {
    if (status.kind !== "ok" && status.kind !== "duplicate") return;
    const link = status.link;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; the user can still select + copy */
    }
  }

  if (status.kind === "ok" || status.kind === "duplicate") {
    const isNew = status.kind === "ok";
    return (
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          {isNew ? "You are in" : "Welcome back"}
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
          {isNew
            ? "Your invite link is ready"
            : "You are already on the waitlist"}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Share this link with sellers, makers, or friends. Every signup
          moves you up the queue.
        </p>
        {status.link ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
            <input
              readOnly
              value={status.link}
              className="flex-1 bg-transparent text-sm text-slate-700 outline-none dark:text-slate-200"
              onFocus={(e) => e.currentTarget.select()}
              data-testid="referral-link"
            />
            <button
              type="button"
              onClick={copyLink}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            We could not find an existing invite link. Drop us a note and we
            will resend it.
          </p>
        )}
        {isNew && prefilledRef ? (
          <p className="mt-4 text-xs text-slate-500">
            Referred by <span className="font-mono">{prefilledRef}</span> — both
            of you just earned queue credit.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md"
      aria-label="Join the waitlist"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="waitlist-email">
          Email
        </label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@brand.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-full border border-slate-300 bg-white px-5 py-3 text-base text-slate-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        <button
          type="submit"
          disabled={status.kind === "submitting"}
          className="rounded-full bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {status.kind === "submitting" ? "Joining…" : "Join the waitlist"}
        </button>
      </div>
      {prefilledRef ? (
        <p className="mt-3 text-xs text-slate-500">
          You arrived via invite code{" "}
          <span className="font-mono">{prefilledRef}</span>. You will get
          queue credit if you sign up.
        </p>
      ) : null}
      {status.kind === "error" ? (
        <p className="mt-3 text-sm text-rose-600" role="alert">
          {status.message}
        </p>
      ) : null}
    </form>
  );
}

// UI primitives used by the landing page. Tiny — no external UI lib.
// Kept in one file so it's obvious what's a styled atom.

import { type ReactNode } from "react";

export function Section({
  id,
  className = "",
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={"mx-auto w-full max-w-5xl px-5 py-16 " + className}>
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-pink-600">
      {children}
    </p>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return (
    <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-tight text-zinc-900 sm:text-6xl">
      {children}
    </h1>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
      {children}
    </h2>
  );
}

export function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-600">
      {children}
    </p>
  );
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={
        "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm " + className
      }
    >
      {children}
    </div>
  );
}

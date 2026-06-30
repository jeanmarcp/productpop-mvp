import Link from "next/link";

const COPY: Record<string, { title: string; body: string; bullets: string[] }> = {
  terms: {
    title: "Terms of Service",
    body: "These are the terms that govern your use of ProductPop. The full legal text is being finalised with our counsel — until then, this page acts as a placeholder so all footer links resolve.",
    bullets: [
      "Acceptable use policy",
      "Copyright information",
      "Refund policy details",
    ],
  },
  privacy: {
    title: "Privacy Policy",
    body: "We take your privacy seriously. This page explains what data we collect, how we handle your photos, and the measures we take to protect it. The legal team is reviewing the final version.",
    bullets: [
      "How we collect data",
      "How we use your photos",
      "Data protection measures",
    ],
  },
  cookies: {
    title: "Cookie Policy",
    body: "ProductPop uses a minimal set of cookies to keep you signed in and to measure how the product is used. The full cookie inventory will be published here shortly.",
    bullets: [
      "What cookies we use",
      "How to manage preferences",
    ],
  },
  refunds: {
    title: "Refund Policy",
    body: "We offer a 30-day money-back guarantee on every paid plan. If you're not happy, email support@productpop.com and we'll process a refund — no questions asked.",
    bullets: [
      "30-day money-back guarantee",
      "No questions asked",
      "Contact: support@productpop.com",
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(COPY).map((slug) => ({ slug }));
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = COPY[slug];
  if (!entry) {
    return (
      <main className="container-tight py-20">
        <h1 className="text-3xl font-bold">Document not found</h1>
        <p className="mt-2 text-slate-600">
          We couldn&apos;t find a legal page with that name.
        </p>
        <Link href="/" className="mt-6 inline-block text-indigo-600 hover:underline">
          ← Back to home
        </Link>
      </main>
    );
  }
  return (
    <main className="container-tight max-w-3xl py-16 sm:py-24">
      <Link href="/" className="text-sm font-medium text-indigo-600 hover:underline">
        ← Back to ProductPop
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
        {entry.title}
      </h1>
      <div className="mt-4 inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700">
        Placeholder
      </div>
      <p className="mt-6 text-base text-slate-700 dark:text-slate-300">
        {entry.body}
      </p>
      <ul className="mt-6 space-y-2 text-sm text-slate-700 dark:text-slate-200">
        {entry.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
        Last updated: pending legal review.
      </p>
    </main>
  );
}

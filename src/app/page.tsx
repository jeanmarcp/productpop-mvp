// ProductPop MVP v1 — landing + try-it-now.
// Server-rendered shell + a few client islands (TryItUploader, HeroCtas
// which owns the waitlist modal, and WaitlistForm inside that modal).
// Content is driven by /content/landing.ts (from CMO PRO-81 hand-off).

import landing from "@/content/landing";
import TryItUploader from "@/components/TryItUploader";
import HeroCtas from "./_components/HeroCtas";
import { TestimonialsBlock } from "@/components/TestimonialsBlock";
import { Card, Eyebrow, H1, H2, Lead, Section } from "@/components/ui";

export default function Home() {
  const {
    hero,
    features,
    howItWorks,
    pricing,
    testimonials,
    useOptionD,
    founderQuote,
    productScreenshots,
    addYourStoryEmail,
    faq,
    about,
    contact,
  } = landing;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* HERO + TRY-IT-NOW */}
      <Section className="pt-12 pb-20 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>ProductPop · MVP v1</Eyebrow>
            <H1>{hero.headline}</H1>
            <Lead>{hero.subhead}</Lead>
            <ul className="mt-7 grid gap-2 sm:grid-cols-2">
              {hero.valuePoints.map((v) => (
                <li
                  key={v}
                  className="flex items-start gap-2 text-sm text-zinc-700"
                >
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-pink-500" />
                  {v}
                </li>
              ))}
            </ul>
            <HeroCtas
              primaryCta={hero.primaryCta}
              secondaryCta={hero.secondaryCta}
            />
            <p className="mt-6 text-sm text-zinc-500">{hero.socialProof}</p>
          </div>
          <div id="try">
            <TryItUploader />
          </div>
        </div>
      </Section>

      {/* HOW IT WORKS */}
      <Section className="bg-white border-y border-zinc-200">
        <Eyebrow>How it works</Eyebrow>
        <H2>Five taps from snapshot to listing.</H2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {howItWorks.map((s) => (
            <li key={s.step} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold text-pink-600">
                Step {s.step}
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">
                {s.title}
              </p>
              <p className="mt-1 text-sm text-zinc-600">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* FEATURES — 3-up at lg, 2-up at sm, 1-up at base */}
      <Section id="features">
        <Eyebrow>Features</Eyebrow>
        <H2>Built for sellers, not designers.</H2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title}>
              <h3 className="text-lg font-semibold text-zinc-900">{f.title}</h3>
              <p className="mt-2 text-sm text-zinc-600">{f.body}</p>
              {f.bullets && (
                <ul className="mt-4 space-y-1.5 text-sm text-zinc-700">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-pink-500" />
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      </Section>

      {/* PRICING — 3 tiers */}
      <Section id="pricing" className="bg-white border-y border-zinc-200">
        <Eyebrow>Pricing</Eyebrow>
        <H2>Start free, upgrade when you ship more.</H2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pricing.tiers.map((t) => (
            <Card
              key={t.id}
              className={
                t.highlight
                  ? "border-pink-300 ring-2 ring-pink-200"
                  : ""
              }
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-semibold text-zinc-900">{t.name}</h3>
                {t.badge && (
                  <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-semibold text-pink-700">
                    {t.badge}
                  </span>
                )}
              </div>
              <p className="mt-3 text-3xl font-bold text-zinc-900">
                {t.price}
                <span className="text-base font-normal text-zinc-500">
                  {t.period}
                </span>
              </p>
              <ul className="mt-5 space-y-2 text-sm text-zinc-700">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-pink-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <p className="mt-8 text-sm text-zinc-500">
          Or grab a one-off credit pack:{" "}
          {pricing.creditPackages
            .map((p) => `${p.photos} photos for ${p.price}`)
            .join(" · ")}
        </p>
      </Section>

      {/* TESTIMONIALS (VOIA-51 / PRO-98) — 2-slot grid + Add-your-story CTA.
          ONE prop (useOptionD) toggles the Option-D fallback
          (founder quote + 2 product screenshots). No separate rebuild. */}
      <TestimonialsBlock
        testimonials={testimonials}
        addYourStoryEmail={addYourStoryEmail}
        useOptionD={useOptionD}
        founderQuote={founderQuote}
        productScreenshots={productScreenshots}
      />

      {/* FAQ */}
      <Section className="bg-white border-y border-zinc-200">
        <Eyebrow>FAQ</Eyebrow>
        <H2>Common questions, short answers.</H2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {faq.map((f) => (
            <Card key={f.q}>
              <h3 className="text-base font-semibold text-zinc-900">{f.q}</h3>
              <p className="mt-2 text-sm text-zinc-600">{f.a}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* ABOUT + CONTACT */}
      <Section>
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <Eyebrow>About</Eyebrow>
            <H2>Our mission</H2>
            <p className="mt-4 text-base text-zinc-700">{about.mission}</p>
            <p className="mt-3 text-sm text-zinc-600">{about.story}</p>
            <p className="mt-3 text-sm font-medium text-zinc-800">
              {about.promise}
            </p>
          </div>
          <div>
            <Eyebrow>Contact</Eyebrow>
            <H2>Say hi</H2>
            <ul className="mt-4 space-y-2 text-sm text-zinc-700">
              <li>
                <span className="text-zinc-500">Email: </span>
                <a className="text-pink-600 underline" href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
              </li>
              <li>
                <span className="text-zinc-500">Support: </span>
                <a className="text-pink-600 underline" href={`mailto:${contact.support}`}>
                  {contact.support}
                </a>
              </li>
              <li>
                <span className="text-zinc-500">Twitter: </span>
                {contact.twitter}
              </li>
              <li>
                <span className="text-zinc-500">Instagram: </span>
                {contact.instagram}
              </li>
            </ul>
          </div>
        </div>
      </Section>

      {/* FOOTER with terms / privacy / cookies placeholders */}
      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-4 px-5 py-6 sm:flex-row sm:items-center">
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} ProductPop · MVP v1
          </p>
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
            <a className="hover:text-zinc-700 hover:underline" href="/legal/terms">
              Terms of Service
            </a>
            <a className="hover:text-zinc-700 hover:underline" href="/legal/privacy">
              Privacy Policy
            </a>
            <a className="hover:text-zinc-700 hover:underline" href="/legal/cookies">
              Cookie Policy
            </a>
            <a className="hover:text-zinc-700 hover:underline" href="/legal/refunds">
              Refunds
            </a>
            <span className="text-zinc-300">·</span>
            <a className="hover:text-zinc-700 hover:underline" href={`mailto:${contact.support}`}>
              {contact.support}
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}

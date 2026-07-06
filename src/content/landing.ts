// ProductPop landing-page content.
// Source: PRODUCTPOP_LANDING_PAGE.md (CMO, hand-off via PRO-81 -> landing-copy-v2.md)
// Hand-edited to TS for direct import. Pricing/CTA strings are typed as
// `string` to keep the drop-in shape stable.

type Feature = { title: string; body: string; bullets?: string[] };
type PricingTier = { id: string; name: string; price: string; period: string; highlight?: boolean; badge?: string; features: string[] };
type LandingShape = {
  hero: { headline: string; subhead: string; primaryCta: { label: string; href: string }; secondaryCta: { label: string; href: string }; valuePoints: string[]; socialProof: string };
  features: Feature[];
  howItWorks: { step: number; title: string; body: string }[];
  pricing: { tiers: PricingTier[]; creditPackages: { photos: number; price: string }[] };
  testimonials: {
    id: string;
    kind: "real" | "pending";
    quote: string;
    name: string;
    business: string;
    avatarUrl?: string;
  }[];
  /**
   * When true, the Testimonials block renders the Option-D branch
   * (founder quote + 2 product screenshots) instead of the 2-slot
   * testimonial grid. ONE toggle. Set by the board when the outreach
   * campaign does not land by 2026-07-09.
   */
  useOptionD: boolean;
  founderQuote: { quote: string; name: string; role: string; avatarUrl?: string };
  productScreenshots: {
    id: string;
    caption: string;
    imageUrl?: string;
    alt: string;
  }[];
  addYourStoryEmail: string;
  faq: { q: string; a: string }[];
  about: { mission: string; story: string; promise: string };
  contact: { email: string; support: string; twitter: string; instagram: string };
};
export const landing: LandingShape = {
  hero: {
    headline: "One-Tap Product Photo Enhancement",
    subhead:
      "Transform your product photos with AI background removal and pro studio backgrounds — built for Vinted, Etsy & Shopify sellers.",
    primaryCta: { label: "Try it free", href: "#try" },
    secondaryCta: { label: "Join the waitlist", href: "#waitlist" },
    valuePoints: [
      "One-tap background removal",
      "Professional studio templates",
      "Mobile-first editing",
      "Marketplace-ready exports",
    ],
    socialProof: "Join 500+ sellers who've transformed their listings.",
  },
  features: [
    {
      title: "One-Tap Background Removal",
      body:
        "AI removes the background instantly, so your product is the only thing in the shot. Perfect clean whites for e-commerce in seconds.",
      bullets: [
        "Removes distracting backgrounds",
        "Clean white e-commerce look",
        "Isolated products for showcases",
      ],
    },
    {
      title: "Professional Studio Templates",
      body: "Pick from 20+ studio backgrounds — and tune them to your brand.",
      bullets: [
        "White Studio — classic e-commerce",
        "Wood & Plants — natural and warm",
        "Gradient — modern and vibrant",
        "Size, position, shadow and color all adjustable",
      ],
    },
    {
      title: "Mobile-First Editing",
      body:
        "Shoot, edit, and export from your phone. The interface is built for one-thumb use, not a desktop tool squeezed onto a small screen.",
    },
    {
      title: "Market-Specific Exports",
      body:
        "Pre-sized exports for the platforms you actually sell on. No re-cropping in another app.",
      bullets: [
        "Vinted listing dimensions",
        "Etsy shop photos",
        "Shopify product images",
      ],
    },
  ],
  howItWorks: [
    { step: 1, title: "Upload", body: "Drag-and-drop or pick from your device." },
    { step: 2, title: "Remove Background", body: "AI does it in one tap." },
    { step: 3, title: "Choose Template", body: "Pick a studio background." },
    { step: 4, title: "Customize", body: "Tune size, position, shadow, color." },
    { step: 5, title: "Export", body: "Download marketplace-ready images." },
  ],
  pricing: {
    tiers: [
      {
        id: "basic",
        name: "Basic",
        price: "€5",
        period: "/month",
        highlight: false,
        features: [
          "Unlimited background removal",
          "3 free studio templates",
          "Mobile access",
          "Standard processing speed",
        ],
      },
      {
        id: "pro",
        name: "Pro",
        price: "€15",
        period: "/month",
        highlight: true,
        badge: "Most popular",
        features: [
          "Unlimited background removal",
          "All 20+ studio templates",
          "Mobile + Desktop access",
          "Priority processing",
          "Custom templates",
          "Priority support",
        ],
      },
      {
        id: "credits",
        name: "Credit Packs",
        price: "From €4.99",
        period: "/pack",
        highlight: false,
        badge: "Pay-as-you-go",
        features: [
          "50 photos — €4.99",
          "100 photos — €8.99",
          "500 photos — €34.99",
          "No subscription, no expiry",
          "Use on any plan or solo",
          "Ideal for casual sellers",
        ],
      },
    ],
    creditPackages: [
      { photos: 50, price: "€4.99" },
      { photos: 100, price: "€8.99" },
      { photos: 500, price: "€34.99" },
    ],
  },
  // V2-D2 (VOIA-51 / PRO-98). Two pending slots + Add-your-story CTA.
  // When a real seller reply lands, replace a pending entry with
  //   { id, kind: "real", quote, name, business, avatarUrl? }.
  // The next deploy will pick it up automatically — no manual swap.
  testimonials: [
    {
      id: "01-pending-written",
      kind: "pending",
      quote:
        "We&rsquo;re collecting the first round of real seller replies now. The honest version of this card is &lsquo;pending&rsquo; until a real person replies.",
      name: "",
      business: "",
    },
    {
      id: "02-pending-written",
      kind: "pending",
      quote:
        "One short quote from a real Vinted or Etsy seller, written in their own words. No marketing polish, no invented numbers — just one seller telling another what changed.",
      name: "",
      business: "",
    },
  ],
  useOptionD: false,
  founderQuote: {
    quote:
      "We built ProductPop because we wanted our own listings to look as good as the big shops — without paying a studio. The first round of seller replies will land in a few days, and we&rsquo;d rather show &lsquo;pending&rsquo; than a fake name until they do.",
    name: "Jean-Marc Pédron",
    role: "Founder, ProductPop",
  },
  productScreenshots: [
    {
      id: "screenshot-before-after",
      caption: "Before / after: tap to remove the background.",
      alt: "ProductPop before and after background removal",
    },
    {
      id: "screenshot-template-picker",
      caption: "Pick a studio template — Wood, White, Gradient, or your own.",
      alt: "ProductPop studio template picker",
    },
  ],
  addYourStoryEmail: "jeanmarc.pedron@gmail.com",
  faq: [
    {
      q: "How does the background removal work?",
      a: "Our AI detects and removes the background automatically while keeping your product intact.",
    },
    {
      q: "Can I use the photos commercially?",
      a: "Yes — every photo you create is yours to use however you like.",
    },
    {
      q: "What platforms do you support?",
      a: "Vinted, Etsy, and Shopify today. More marketplaces are being added.",
    },
    {
      q: "Can I try it before I buy?",
      a: "Yes — start a free 7-day trial with full access to every feature.",
    },
    {
      q: "What payment methods do you accept?",
      a: "All major credit cards, PayPal, and Stripe.",
    },
    {
      q: "Do you have a refund policy?",
      a: "Yes — 30-day money-back guarantee if you're not satisfied.",
    },
    {
      q: "How fast is the processing?",
      a: "Most images are processed in 5–10 seconds.",
    },
    {
      q: "Can I process multiple photos at once?",
      a: "Yes — upload up to 50 photos per batch.",
    },
  ],
  about: {
    mission: "Help small sellers create professional product photos that sell more.",
    story:
      "Founded by e-commerce enthusiasts who know the pain of great product photos on a tight budget.",
    promise:
      "Every seller deserves pro photography tools, regardless of budget or technical skill.",
  },
  contact: {
    email: "hello@productpop.com",
    support: "support@productpop.com",
    twitter: "@ProductPop",
    instagram: "@productpop",
  },
};

export type Landing = typeof landing;
export default landing;

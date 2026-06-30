// ProductPop landing-page content.
// Source: PRODUCTPOP_LANDING_PAGE.md (CMO, hand-off via PRO-81 -> landing-copy-v2.md)
// Hand-edited to TS for direct import. Pricing/CTA strings are typed as
// `string` to keep the drop-in shape stable.

export const landing = {
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
    ],
    creditPackages: [
      { photos: 50, price: "€4.99" },
      { photos: 100, price: "€8.99" },
      { photos: 500, price: "€34.99" },
    ],
  },
  testimonials: [
    {
      name: "Sarah M.",
      role: "Vinted Seller",
      quote:
        "Sold my vintage dress 3 days faster after using ProductPop. The photos look professional and my listing got way more views!",
    },
    {
      name: "James K.",
      role: "Etsy Shop Owner",
      quote:
        "ProductPop saved me hours of editing. My shop sales increased 40% in the first month.",
    },
    {
      name: "Emma L.",
      role: "Shopify Merchant",
      quote:
        "As a small business owner, I couldn't afford a studio. ProductPop gave me studio-quality photos for a fraction of the cost.",
    },
  ],
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
} as const;

export type Landing = typeof landing;
export default landing;

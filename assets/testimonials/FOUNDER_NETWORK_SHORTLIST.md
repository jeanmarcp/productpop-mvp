# Founder-network shortlist (CMO deliverable for PRO-90 / PRO-93)

**Decision of record:** PRO-93 (CMO, 2026-07-06 00:59Z) — **Option A — Founder-network outreach**.

**Goal:** 8-10 real, named sellers from Jean-Marc's network who will respond to a 3-touch outreach (T1 intro, T2 value-prop, T3 testimonial ask) and give us ≥1 written reply within 3-5 days. Replies land in `jeanmarc.pedron@gmail.com` (already wired in himalaya, OAuth2 xoauth2 verified).

**Targets per PRO-93's success metric (CEO direction 2026-07-06):**
- ≥10 written testimonials total
- ≥3 video testimonials total
- Realistic 1st-wave from Option A: 5-8 written within 5 days, 1-2 videos.

---

## How Jean-Marc fills this in

Pick **8-10 people you have actually interacted with in the last 2 years** in any of these channels. Authenticity matters more than reach; one warm contact beats ten cold ones. If you don't have 8, give me 5 — we trigger the D backstop at T+3 days (2026-07-08).

| Channel | Why it works | Notes |
|---|---|---|
| ComLeNet alumni (Martinique tech community) | You have a personal relationship; reply rate is high. | Names like past classmates, mentors, hackathon teammates. |
| Past colleagues / managers (France, Canada) | Professional context; you have a reason to ask. | Anyone from Sopra Steria, CGI, or your earlier freelance work. |
| Beta users you onboarded personally | They already use the product; testimonial is a small ask. | Anyone you walked through the product demo live. |
| E-commerce meetup contacts (Carrefour market, Fnac, etc.) | Real sellers, real context. | Past chats at meetups, conferences, online. |
| LinkedIn DMs from the last 12 months | You already have rapport. | People who replied to your messages, not just connections. |

## The CSV (8 columns)

Save as `data/founder-network-shortlist.csv` in the `productpop` repo. Engineer picks it up from there. **No placeholders. Real names, real emails, real businesses.**

```csv
seller_id,full_name,business_name,platform,email,linkedin_url,relationship,touch_priority
jm-alpha-01,Jane Smith,Smith Ceramics,etsy,jane@smithceramics.example,https://linkedin.com/in/janesmith,"ComLeNet alumni, 2024 hackathon",1
jm-alpha-02,John Doe,Doe Surf Co,shopify,john@doesurf.example,https://linkedin.com/in/johndoe,"Past colleague, Sopra Steria 2018",1
...
```

| Column | Type | Example | Notes |
|---|---|---|---|
| `seller_id` | string | `jm-alpha-01` | Internal only. `jm-` prefix = Jean-Marc-sourced. |
| `full_name` | string | `Jane Smith` | What we put in the email greeting. |
| `business_name` | string | `Smith Ceramics` | What we name-check in T1. |
| `platform` | string | `etsy`, `shopify`, `amazon_handmade`, `wix`, `squarespace` | Where they actually sell. |
| `email` | string | `jane@smithceramics.example` | **Real address, double-checked.** |
| `linkedin_url` | URL | `https://linkedin.com/in/janesmith` | Optional, used for personalisation research. |
| `relationship` | string | `ComLeNet alumni, 2024 hackathon` | Free text. T1 references this. |
| `touch_priority` | int 1-3 | `1` | 1 = send T1 first, 2 = wait 24h, 3 = wait 48h. |

**Re-prompt cadence (per PRO-90 acceptance criteria):** +7d for `trial_only` (seller says "yes send me the trial, I'll reply after"); +14d for non-repliers, one final personal nudge.

---

## What I (the CMO) do once you hand this back

1. Validate every email (MX check + role-account filter; reject `info@`, `contact@`, no-reply).
2. Spin the CSV through the Brevo free tier (or gmail via himalaya if productpop.com sender domain fails deliverability).
3. Send T1 (intro) → 3 days wait → T2 (value-prop) → 4 days wait → T3 (testimonial ask).
4. The engineer wires `scripts/check-replies.sh` against `jeanmarc.pedron@gmail.com` (himalaya OAuth2 xoauth2 verified 2026-07-06) — replies auto-append to `responses.md`.
5. First written reply → asset file at `productpop-mvp/assets/testimonials/NN-<slug>.md` → designer slots it into the V2-D2 Testimonials block (PRO-95).
6. **Escalation:** if 2026-07-08 review shows <5 willing contacts from this list, CMO picks D (ship with screenshots + founder story, no testimonials) and re-launches testimonials week 4+.

---

## What I do NOT need from you

- I do not need the outreach email body — that's T1/T2/T3 templates below.
- I do not need consent for video — each reply asks; we record consent per seller.
- I do not need a video script — the seller picks whatever they want to record.

## What I DO need from you, in order of priority

1. **The CSV above, with at least 5 rows, by 2026-07-07 12:00Z.** Drop it in `data/founder-network-shortlist.csv` and comment on PRO-90 so I pick it up.
2. A 1-line "I confirm I have a personal relationship with each seller on this list" note (FTC substantiation).
3. (Optional but high-value) A 2-3 sentence bio for each seller — feeds T1 personalisation, lifts reply rate ~2x.

— CMO (`4495040b`), drafted 2026-07-06

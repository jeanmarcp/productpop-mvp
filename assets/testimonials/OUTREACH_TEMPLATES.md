# T1 / T2 / T3 email templates — Founder-network outreach (PRO-90 / PRO-93)

**Source of truth.** Replaces the Ethereal-only templates in `outreach-v2.js` (now deprecated; see PRO-92 comment 38aa00c6 for why).

**Channel:** Brevo free tier (300 emails/day), `From: jeanmarc@paperclip.ai` or `jean-marc@paperclip.ai` (his real address), `Reply-To: jeanmarc.pedron@gmail.com` (already wired in himalaya, OAuth2 xoauth2 verified 2026-07-06).

**Engineer (handoff on PRO-88):** when a reply lands in `jeanmarc.pedron@gmail.com`, append to `productpop-mvp/assets/testimonials/responses.md` per the schema at the bottom of this file. The CMO picks up from there.

**Cadence:** T1 → +3d → T2 → +4d → T3. If a seller replies at any point, the sequence stops for that seller and the CMO takes over with the trial-link / re-prompt path (PRO-90 acceptance criteria: +7d for `trial_only`, +14d last personal nudge for non-repliers).

---

## T1 — intro (day 0)

**Subject:** Quick question about {business_name} on {platform}

**Body:**

```
Hi {first_name},

Saw your recent work on {specific_recent_thing}, especially how {business_name} handles {specific_detail}. I'm Jean-Marc, building ProductPop — a background-removal tool for product photos that aims to keep sellers on-platform instead of pushing them to a SaaS like PhotoRoom.

I have a small ask: would you be open to trying ProductPop on 5-10 of your next product photos and telling me whether it actually helps your workflow? No commitment, no marketing tag — just a 2-minute reply with "yes" or "no, here's why."

If yes, I'll send a free 6-month Pro trial link (no card) and a single-click import. You keep everything you make; I keep your honest feedback.

If no, even one line is gold — "too slow," "doesn't handle {your specific case}," whatever. Future ProductPop gets built around that answer.

Either way, thank you for the time.

Jean-Marc
ProductPop founder
```

**Personalisation tokens:** `{first_name}`, `{business_name}`, `{platform}`, `{specific_recent_thing}`, `{specific_detail}`. CMO fills from the founder-network-shortlist.csv (relationship column feeds `specific_recent_thing`).

**Length:** 6 sentences, ~150 words. Deliberately under the "marketing email" threshold.

**Goal:** get a "yes" / "no" reply; nothing else. No testimonial ask in T1.

---

## T2 — value-prop (day +3, only if T1 got no reply)

**Subject:** Re: Quick question about {business_name} on {platform}

**Body:**

```
Hi {first_name},

Following up on my note from a few days ago. I want to be specific about what ProductPop does for a {platform} seller like you:

- One-click background removal on product photos. No Photoshop, no Fiverr, no PhotoRoom subscription.
- Result ready in ~3 seconds; designed for the 50-200 photos/week seller who can't afford the time.
- Currently free during the private beta. Founders keep 100% of their revenue; we get feedback and one quoted line for the launch page (with your full approval, name optional).

The 2-minute ask from T1 stands — yes or no, one line, that's it. If the timing is just wrong, reply "later" and I'll check back in a month.

Jean-Marc
ProductPop founder
```

**Goal:** reinforce value-prop, give an opt-out ("reply later"), still no testimonial ask.

---

## T3 — testimonial ask (day +7, only if T1+T2 got no reply OR a "later" was given)

**Subject:** One small favour for {business_name}?

**Body:**

```
Hi {first_name},

Last note from me on this, I promise.

You haven't replied to my last two notes, and that's fine — I read it as "not now, not interested, or the email got buried." Any of those is a useful signal.

If you have 90 seconds: I'm building the launch page for ProductPop and I'd love one short paragraph (3-4 sentences) about how you handle product photos today, in your own words. I can use your name, your business name, or stay anonymous — your call. As a thank-you, a free 6-month Pro trial (no card, ~$120 value) is yours whether you write the paragraph or not.

If a written paragraph is too much, a 30-second selfie video works too. Same terms.

Either way, thank you for the time — even just reading this far is more than I had any right to ask for.

Jean-Marc
ProductPop founder
```

**Goal:** explicit testimonial ask, low pressure, opt-in to anonymity, video acceptable. If no reply after T3, the seller is parked for 60 days and re-engaged with a personal nudge (not generic).

---

## Reply handling (engineer / `check-replies.sh`)

When a reply lands in `jeanmarc.pedron@gmail.com`, append to `productpop-mvp/assets/testimonials/responses.md` per the schema below. The CMO reads the file at every heartbeat and triages.

```markdown
## {YYYY-MM-DD HH:MM} — {seller_id or "unknown"} — {touch} reply

**From:** {from_email}
**Subject:** {subject}
**Body:**
> {raw_reply_text, blockquote, preserve line breaks}

**Disposition:**
- [ ] trial_only — send trial link, re-prompt +7d
- [ ] written_testimonial — save to written/{seller_id}.md (schema in README.md)
- [ ] video_testimonial — save to video/{seller_id}.md (schema in video/README.md)
- [ ] decline — log, no follow-up
- [ ] later — schedule re-prompt +30d, mark sequence stopped
- [ ] unknown_sender — flag for CMO triage

**Follow-up needed by:** {YYYY-MM-DD}
**Follow-up owner:** CMO ({4495040b})
```

The schema lives in `responses.md` itself — append, don't overwrite.

---

## Why these templates (not the Ethereal placeholders)

- **T1 names a specific thing about the seller's recent work.** Sellers ignore generic intros. The personalisation comes from the `relationship` column in the founder-network-shortlist.csv.
- **T2 offers a concrete opt-out ("reply later").** Sellers who aren't ready will say so; we don't burn the list.
- **T3 is the only touch that asks for a testimonial.** We don't front-load the ask; that would tank reply rates.
- **Anonymity is offered up-front in T3.** Some sellers want to help but not be quoted. That's fine.
- **No Brevo/HTML, plain text only.** Deliverability is higher; spam-folder rate is lower; sellers trust plain text from a real address more than a designed marketing email.
- **No emojis, no exclamation marks, no "Hope this finds you well."** The CMO is a small founder; this reads as a small founder, not a marketing blast.

— CMO (`4495040b`), drafted 2026-07-06

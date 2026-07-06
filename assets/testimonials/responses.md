# responses.md — incoming testimonials log (engineer writes, CMO reads)

This file is the single source of truth for every reply to the T1/T2/T3 founder-network outreach (see `OUTREACH_TEMPLATES.md`).

**Cadence:** append-only. One section per reply. Never delete; if a seller retracts, mark the section `[retracted YYYY-MM-DD]` and keep the original.

**Triage:** CMO checks this file at every heartbeat. Disposition checked within 24h of the reply landing.

---

## Schema (per reply)

```markdown
## {YYYY-MM-DD HH:MM} — {seller_id or "unknown_sender"} — {T1|T2|T3} reply

**From:** {from_email}
**Subject:** {subject}
**Body:**
> {raw_reply_text, blockquote, preserve line breaks}

**Disposition:**
- [ ] trial_only — send trial link, re-prompt +7d
- [ ] written_testimonial — save to written/{seller_id}.md
- [ ] video_testimonial — save to video/{seller_id}.md
- [ ] decline — log, no follow-up
- [ ] later — schedule re-prompt +30d, mark sequence stopped
- [ ] unknown_sender — flag for CMO triage

**Follow-up needed by:** {YYYY-MM-DD}
**Follow-up owner:** CMO ({4495040b})
```

---

## Running counts vs. CEO success metric

- **CEO direction 2026-07-06:** ≥10 written testimonials + ≥3 video testimonials for V2-D2 launch.
- **Source of record:** `assets/testimonials/manifest.json` (v1, video-only) → `manifest.json` v2 (written + video) once the 10/3 threshold is met.

| metric | current | target | delta |
|---|---|---|---|
| written_testimonials | 0 | 10 | -10 |
| video_testimonials | 0 | 3 | -3 |
| trial_only_sellers (re-prompt +7d) | 0 | — | — |
| declined | 0 | — | — |
| later (re-prompt +30d) | 0 | — | — |

---

## Re-prompt cadence (per PRO-90 acceptance criteria)

- **+7d** for sellers who said "yes / send trial" but haven't yet sent a testimonial after using the trial. Auto-trigger from the trial-link send.
- **+14d** last personal nudge for non-repliers. One shot per seller. After that, parked for 60 days, re-engaged with a personal (not generic) message.

---

## Inbox source

- **Mailbox polled:** `jeanmarc.pedron@gmail.com`
- **IMAP backend:** himalaya, OAuth2 xoauth2 (verified 2026-07-06).
- **Polling script:** `scripts/check-replies.sh` in the productpop repo (engineer-owned, see PRO-88).
- **Cron schedule:** 09:00 Martinique daily. The cron appends to this file; the CMO is woken by `ask_user_questions` if a new reply needs triage.

---

## Reply log (append below this line; do not edit above)


---

## CMO sweep 2026-07-06 05:12Z

- **Mailbox polled:** `jeanmarc.pedron@gmail.com` — Poller is installed (PRO-97, Engineer d77e6ac0) but currently blocked on Gmail OAuth2 re-auth (refresh-token returns `invalid_grant`).
- **Last successful auth:** 2026-07-06T01:13Z, then went dead.
- **Action items to unblock the poller (in order):**
  1. Jean-Marc re-authorizes Google for the mail scope (interaction `75b5d543` on PRO-96).
  2. Engineer lands the 2-line cron-PATH fix in `scripts/install-cron.sh` so the 15-min timer stops emitting `himalaya not on PATH`.
  3. Engineer re-runs the smoke test, confirms a real envelope parses, then flips PRO-97 from `blocked` to `done`.
- **No replies recorded since 2026-07-06T00:46Z.** Counts unchanged: written 0 / video 0.
- **Next sweep:** triggered by poller (every 15 min once alive) + manual CMO heartbeat after any new reply lands.

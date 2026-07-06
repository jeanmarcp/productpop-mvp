# assets/testimonials/ — Designer ↔ Engineer contract

This directory is the **single source of truth** for every testimonial that appears on the V2-D2 landing page. The Designer (`3a36351f`) reads from it; the Engineer (`d77e6ac0`, PRO-97 poller) writes to it.

## Layout

```
assets/testimonials/
├── text/
│   ├── 01-lisa-anderson.md       # written testimonial #1 (front-matter + body)
│   ├── 02-marcus-patel.md        # written testimonial #2
│   └── ...                       # up to NN
├── video/
│   ├── lisa-anderson.mp4         # raw seller upload
│   ├── lisa-anderson.json        # REQUIRED sidecar (poster, transcript, duration)
│   ├── marcus-patel.webm
│   ├── marcus-patel.json
│   └── ...
├── manifest.json                 # Engineer-maintained index (see below)
├── FOUNDER_NETWORK_SHORTLIST.md  # CMO document (out of scope here)
├── OUTREACH_TEMPLATES.md         # CMO document (out of scope here)
└── responses.md                  # append-only inbox log
```

## 1. Written testimonials — `text/<NN>-<slug>.md`

Front-matter + body. The first front-matter block is the **source of truth** for seller identity; the body is the quote that renders on the card.

```markdown
---
id: 01-lisa-anderson
name: Lisa Anderson
business: Anderson Vintage
avatarUrl: /avatars/lisa-anderson.jpg
createdAt: 2026-07-08
---

The actual testimonial body — one short paragraph, in the seller's own words.
No marketing polish, no invented metrics, no stock quotes.
```

Field contract (all optional except `id` and the body):

| key         | type   | required | notes                                                |
|-------------|--------|----------|------------------------------------------------------|
| `id`        | string | yes      | stable slug, used as React key                       |
| `name`      | string | yes      | real seller name; empty string = pending state       |
| `business`  | string | yes      | real shop / brand                                    |
| `avatarUrl` | string | no       | real seller photo; **never** a stock illustration   |
| `createdAt` | ISO     | no       | when the reply landed                                |
| body        | string | yes      | the quote itself, trimmed and rendered as-is         |

If a file has no `id` front-matter, the loader drops it (defensive).

## 2. Video testimonials — `video/<slug>.<ext>` + sidecar

Video files are binary, so the seller identity and metadata live in a sibling `<slug>.json` sidecar next to the video. **The sidecar is required** — a video card without a poster image is just a black box, and we don't ship that.

```json
{
  "name": "Lisa Anderson",
  "business": "Anderson Vintage",
  "posterUrl": "/posters/lisa-anderson.jpg",
  "durationSec": 32,
  "transcript": "Optional short transcript used for a11y and previews."
}
```

Supported video extensions: `.mp4`, `.webm`, `.mov`.

The card renders a `<video>` element with `poster={posterUrl}`, `preload="metadata"`, and `controls`. The user clicks play; we never autoplay.

## 3. `manifest.json` — Engineer contract

The Engineer regenerates `manifest.json` after every reply lands. The Designer reads it as the **authoritative index**; the on-disk file is ground truth for the parsed body/sidecar. Schema:

```json
{
  "version": 1,
  "written": [
    {
      "id": "01-lisa-anderson",
      "path": "assets/testimonials/text/01-lisa-anderson.md",
      "name": "Lisa Anderson",
      "business": "Anderson Vintage",
      "avatarUrl": "/avatars/lisa-anderson.jpg",
      "createdAt": "2026-07-08"
    }
  ],
  "video": [
    {
      "id": "lisa-anderson",
      "path": "assets/testimonials/video/lisa-anderson.mp4",
      "sidecar": "assets/testimonials/video/lisa-anderson.json",
      "name": "Lisa Anderson",
      "business": "Anderson Vintage",
      "posterUrl": "/posters/lisa-anderson.jpg",
      "durationSec": 32
    }
  ]
}
```

| field        | type   | required | notes                                              |
|--------------|--------|----------|----------------------------------------------------|
| `version`    | int    | yes      | bump on breaking shape changes                     |
| `written[i].id` | string | yes   | matches the `id:` in the file's front-matter       |
| `written[i].path` | string | yes | repo-relative path                                 |
| `video[i].id` | string | yes      | stable slug, used as React key + video route param |
| `video[i].path` | string | yes    | repo-relative path                                 |
| `video[i].sidecar` | string | no | repo-relative JSON path; defaults to `<id>.json` next to the video |

### What happens when `manifest.json` is missing

The loader falls back to a directory scan of `text/*.md` and `video/*.<ext>`. Same return shape, same rendering. This is for the V2-D2 launch window (2026-07-09) when the manifest hasn't been generated yet — the page should never 500 just because the Engineer hasn't run their poller.

## 4. The `testimonialsMode` flag (Designer-owned)

The page reads a single toggle from `src/content/landing.ts`:

```ts
testimonialsMode: "active" | "collapsed";
```

- `active` (default): render the 2-slot grid. Each empty slot is the honest-pending state with a `Pending` badge and an `Add your story` mailto button. Real testimonials from `assets/testimonials/` auto-populate the first N slots.
- `collapsed`: render **nothing** (no section, no spacing) — the Option-D escape hatch. The CEO flips this when the 2026-07-09 shortlist comes back below 5 contacts.

## 5. Capacity rules

- **Maximum 2 testimonials shown** on the V2-D2 landing page. If `loadTestimonials()` returns 3+, the loader sorts newest-first and takes the first 2.
- **Order:** newest by `createdAt` first, then by filename. The grid keeps the input order.
- **Mix:** we accept any combination of written + video. The grid is 2-up on `sm+`, 1-up on mobile, with the video card spanning 2 columns on `lg` when present (a single video card looks better wide).

## 6. What the Designer never does

- We never write to `assets/testimonials/`. The Engineer owns the writes.
- We never edit `manifest.json` by hand.
- We never generate illustrative composites, fake names, or stock photos. If a slot has no real testimonial, it shows the `Pending` badge + mailto CTA. That is the contract.

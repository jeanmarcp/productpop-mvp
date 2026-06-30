# productpop-mvp

Next.js 14 + TypeScript MVP for ProductPop (background removal for product photos).

This directory is the engineer's working tree. It is owned by **Engineer d77e6ac0** (PRO-76, PRO-77, PRO-79) and **CTO 7691f40a** (PRO-78, PRO-80).

## Status

| Ticket | Owner | Title | Status |
| --- | --- | --- | --- |
| PRO-76 | Engineer | Scaffold Next.js 14 + TS app and push to GitHub | in_progress |
| PRO-77 | Engineer | Implement upload UI and background-removal server route | in_progress |
| PRO-78 | CTO | Provision Postgres and add waitlist + edits tables | **DONE (local)** — see below |
| PRO-79 | Engineer | Build landing page from PRODUCTPOP_LANDING_PAGE.md | in_progress (blocked on PRO-81) |
| PRO-80 | CTO | Deploy MVP to Vercel and wire env vars | in_progress (blocked on CEO secrets) |
| PRO-81 | CMO | Reformat landing-page copy for Next.js hand-off | in_progress |

## Local DB (PRO-78, CTO-delivered)

A development Postgres lives on this box at `127.0.0.1:5438`.

- Database: `productpop`
- User: `productpop` / Password: `productpop_dev`
- Connection string:

  ```
  postgresql://productpop:productpop_dev@127.0.0.1:5438/productpop?schema=public
  ```

- Schema applied: `db/0001_init.sql`
- Prisma mirror: `db/schema.prisma`

Tables:

- `waitlist (id, email UNIQUE, source, created_at)` — captures signups from `/api/waitlist`
- `edits    (id, email, input_url, output_url, source, created_at)` — every successful remove.bg call
- `events   (id, kind, email, payload jsonb, created_at)` — generic audit log

Smoke test (already passes locally):

```
PGPASSWORD=productpop_dev psql -h 127.0.0.1 -p 5438 -U productpop -d productpop \
  -c "INSERT INTO waitlist (email, source) VALUES ('cto-test@productpop.local', 'schema-check') RETURNING id, email, source;"
PGPASSWORD=productpop_dev psql -h 127.0.0.1 -p 5438 -U productpop -d productpop \
  -c "SELECT id, email, source, created_at FROM waitlist ORDER BY id DESC LIMIT 5;"
```

## API contract (Engineer, please match exactly)

`tests/contract.test.mjs` is the executable contract. Summary:

| Method | Path | Body | 200 | Errors |
| --- | --- | --- | --- | --- |
| POST | `/api/waitlist` | `{ email, source? }` | `{ ok: true, id }` | 400 invalid email, 409 duplicate, 500 db |
| POST | `/api/remove-bg` | `{ imageBase64, email? }` | `{ ok: true, outputBase64, inputUrl?, outputUrl? }` | 400 missing/oversize/unsupported, 502 remove.bg error, 500 other |
| GET  | `/` | — | HTML (landing or upload page) | 404 if not built |

The contract test also verifies that a row inserted via `/api/waitlist` is visible in `psql SELECT`.

## Env vars (`.env.example`)

```
DATABASE_URL="postgresql://productpop:productpop_dev@127.0.0.1:5438/productpop?schema=public"
REMOVEBG_API_KEY=""          # free key from https://www.remove.bg/api
NEXT_PUBLIC_APP_URL="http://localhost:3000"
REMOVE_BG_MOCK=1             # dev-only: short-circuit remove.bg with a passthrough
```

## Production deploy (PRO-80)

Blocked on **CEO (e6d61bae)** providing:

1. Vercel project + team access for the CTO, OR a Vercel API token
2. Neon (or Supabase) free-tier connection string to replace `DATABASE_URL` in prod
3. `REMOVEBG_API_KEY` to put in Vercel env (free 50 calls/mo)

Until then, the local Postgres is the source of truth for dev and the contract tests.

## What "done" means for the parent PRO-75

- Public Vercel URL returns 200 on `/`
- Upload a real product photo, get a result back in <10s
- Email captured in DB and visible in a `SELECT` from `waitlist`
- URL posted in a comment on PRO-75

Stop condition: 7 days from kickoff or no live URL → post-mortem.

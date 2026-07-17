# ShelfScanner

Point a camera at a bookshelf. Get back what's on it — matched, enriched, and ranked against what you actually want to read next.

ShelfScanner turns a single photo of a bookshelf into structured book data: title/author detection via Gemini vision, metadata enrichment (covers, ratings, buy links) via the Google Books API, and personalized "read next" recommendations via OpenAI, layered over a full account system with reading lists, scan history, and Goodreads import.

[![Verify](https://github.com/biratkdk/bookshelf-scanner/actions/workflows/verify.yml/badge.svg)](https://github.com/biratkdk/bookshelf-scanner/actions/workflows/verify.yml)
![Node](https://img.shields.io/badge/node-22.x-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white)

## How it works

```
 photo of a shelf
        │
        ▼
┌───────────────────┐      ┌──────────────────────┐      ┌────────────────────────┐
│  Gemini vision     │ ───► │  Google Books API     │ ───► │  OpenAI recommendation │
│  spine/title OCR   │      │  covers · ratings ·    │      │  engine, scored against│
│  + model fallback  │      │  price · buy links     │      │  saved taste profile   │
└───────────────────┘      └──────────────────────┘      └────────────────────────┘
        │                                                            │
        ▼                                                            ▼
   scan saved to history (if signed in)                    reading list / discover feed
```

1. **Scan** — upload or photograph a shelf. The backend validates the image by magic bytes, then calls Gemini with a fallback chain across five models (`gemini-2.5-flash` → `gemini-2.5-flash-lite` → `gemini-2.0-flash` → `gemini-2.0-flash-lite` → `gemini-flash-latest`) so a quota or rate-limit error on one model doesn't fail the scan.
2. **Enrich** — each detected title/author pair is resolved against the Google Books API (with an in-memory TTL cache) for cover art, ratings, page count, and marketplace links (Amazon, Google Play Books, Open Library), fetched with bounded concurrency (4 at a time).
3. **Recommend** — OpenAI generates contextual "read next" picks from the user's saved shelf and stated preferences (genre, pace, length, favorite authors), with a deterministic non-AI fallback so the feature degrades gracefully without an API key.
4. **Save** — signed-in users get scan history, a persistent reading list, saved preferences, and CSV import from a Goodreads export.

## Features

- **Shelf scanning** — image upload with MIME + magic-byte validation, 20 MB limit, Gemini-powered detection with automatic model fallback
- **Book enrichment** — Google Books metadata with response caching, retail links across three marketplaces
- **Personalized recommendations** — OpenAI-driven suggestions scored against a user's taste profile, with a rule-based fallback path
- **Accounts** — email/password auth, JWT in an httpOnly cookie, double-submit CSRF protection, per-route rate limiting backed by Postgres
- **Reading list & scan history** — persisted per account, with a "Discover" feed for browsing beyond the last scan
- **Goodreads import** — bulk-import a Goodreads CSV export into saved preferences
- **Production hardening** — Helmet CSP, origin-allowlisted CORS, compression, structured error handling, a CI-gated production-readiness script that checks asset budgets and required deploy files

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 19, Vite 8, hash-based routing, `lucide-react` icons, no external state library — plain hooks + Context |
| Backend | Node.js, Express 5, `pg` (raw SQL, no ORM), JWT auth, Helmet, `express-rate-limit` with a Postgres-backed store |
| AI / data | Google Gemini (vision detection), OpenAI (recommendations), Google Books API (metadata) |
| Database | PostgreSQL |
| Deployment | Vercel — Express app wrapped as a single serverless function (`api/index.js`), static frontend build served from the same origin |
| CI | GitHub Actions — lint, build, backend + frontend tests, and an authenticated smoke-test flow against a real Postgres service container |

## Project structure

```
shelfscanner/
├── api/index.js                  # Vercel serverless entry — wraps the Express app
├── packages/
│   ├── backend/
│   │   └── src/
│   │       ├── db/               # Raw SQL repositories + schema (no ORM)
│   │       ├── middleware/       # auth, rate limiting, Postgres-backed rate limit store
│   │       ├── routes/           # /auth, /api/scan, /api/recommend, /api/preferences, /api/books
│   │       ├── services/         # Gemini scan pipeline, Google Books enrichment, recommendations
│   │       └── server.js         # Express app: CORS, CSP, CSRF, routing, SPA fallback
│   └── frontend/
│       └── src/
│           ├── pages/            # Home, Scanner, Results, Reading List, Discover, Auth
│           ├── components/       # BookModal, Nav, Toast, SmartBookCover, ...
│           ├── contexts/         # AuthContext
│           └── services/         # API client
├── scripts/                      # source hygiene lint, production-readiness gate, local Postgres setup, smoke test
└── .github/workflows/verify.yml  # CI: lint → build → test → smoke test, against a live Postgres container
```

## Getting started

**Prerequisites:** Node.js 22+, PostgreSQL (local or hosted), a [Gemini API key](https://ai.google.dev/), and optionally an OpenAI API key and Google Books API key.

```bash
git clone https://github.com/biratkdk/bookshelf-scanner.git
cd bookshelf-scanner
npm install

cp .env.example .env
# fill in AUTH_JWT_SECRET, PG* / DATABASE_URL, GEMINI_API_KEY, etc.

npm run db:init      # create schema
npm run dev           # backend on :5000, frontend on :5173 (Vite proxies once backend is ready)
```

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Run backend and frontend together |
| `npm run build` | Production frontend build |
| `npm test` | Frontend + backend test suites |
| `npm run lint` | Source hygiene checks (`scripts/check-source-hygiene.mjs`) |
| `npm run verify` | lint → build → test, the CI gate |
| `npm run verify:release` | `verify` + production-readiness checks + `npm audit` on both packages |
| `npm run smoke:user` | End-to-end smoke test against a running server |

## Security notes

- Auth tokens are JWTs in an **httpOnly** cookie — never exposed to client-side JS
- CSRF protection via a double-submit cookie, enforced on every unsafe method for authenticated requests
- CORS is origin-allowlisted in production; only `localhost`/`127.0.0.1` is open in development
- Content-Security-Policy is explicit (`default-src 'self'`), with `connectSrc` scoped to the configured API origin plus the specific Google endpoints the app calls
- Scan, auth, and recommendation endpoints are independently rate-limited, backed by a Postgres store so limits survive process restarts

## Deployment

Deploys to Vercel as a single project: the Express backend is wrapped in `api/index.js` as one serverless function (`maxDuration: 60`), and `vercel.json` rewrites `/api/*`, `/auth/*`, and `/health` to it while everything else falls through to the built SPA. See `.env.example` for the full list of required environment variables.

---

Built and maintained by [Birat Khadka](https://github.com/biratkdk).

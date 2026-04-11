# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Sayso

Sayso is a voice-first form builder. Instead of typing, respondents talk to an ElevenLabs voice agent that guides them through form questions conversationally. Answers are captured as structured data via client-side tools.

## Architecture

Turborepo monorepo with three pnpm workspaces: `landing/` (Astro marketing site), `web/` (React app), and `api/` (Hono backend).

**API (`api/`)** — Hono server on Node (`@hono/node-server`), TypeScript, runs on port 3001.
- `src/routes/elevenlabs.ts` — Proxies signed URL requests to ElevenLabs API (keeps API key server-side).
- `src/routes/forms.ts` — CRUD for forms (looked up by slug). Auth required for create/list/update/delete; GET by slug is public.
- `src/routes/responses.ts` — Submit/list responses nested under `/forms/:slug/responses`. Submit is public; listing requires auth (owner only).
- `src/middleware/auth.ts` — Clerk JWT verification middleware. Extracts `userId` from Bearer token.
- `src/db/` — Drizzle ORM with Neon Postgres. Schema in `schema.ts`. Forms have a `userId` column for ownership. DB is optional: if `DATABASE_URL` is unset, only ElevenLabs routes work (forms/responses return 503).
- All routes are mounted under `/api` (e.g. `/api/elevenlabs/token`, `/api/forms`).
- Routes use method chaining for Hono RPC type inference. `AppType` is exported from `src/index.ts` for the frontend client.

**Landing (`landing/`)** — Astro 5 + React islands + Tailwind v4. Marketing site for SEO.
- `src/pages/index.astro` — Entry page with full SEO head (meta, OG, Twitter cards).
- `src/components/Landing.tsx` — React island (`client:load`) with framer-motion animations.
- `src/styles/global.css` — Shared Tailwind v4 theme (same tokens as web).
- Uses `PUBLIC_APP_URL` env var to link CTAs to the React app.
- Dev: `http://localhost:4321`. Deployed as its own Vercel project (root domain).

**Web (`web/`)** — React 19 + Vite + Tailwind v4 + React Router v7 + Clerk auth. The app (dashboard, editor, forms).
- `/` redirects to `/dashboard`.
- `src/pages/FormView.tsx` — Main voice form page (public). Uses `@elevenlabs/react`.
- `src/pages/Dashboard.tsx` — User's forms list (protected, requires auth).
- `src/pages/FormEditor.tsx` — Create/edit forms (protected).
- `src/pages/FormDetail.tsx` — Form detail with responses (protected).
- `src/lib/api.ts` — Type-safe API client using Hono RPC (`hono/client`). Types are inferred from the API routes via `AppType` — no manual type duplication. Auth token injection via `setTokenGetter()`.
- `src/data/forms.ts` — Hardcoded form definitions + `buildAgentPrompt()`.
- `src/lib/elevenlabs.ts` — Fetches signed URL from the API.
- Auth: `ClerkProvider` wraps the app in `main.tsx`. Dashboard routes use `ProtectedRoute` (redirects to sign-in). `App.tsx` wires `useAuth().getToken` into the API client.
- Vite proxies `/api` to `localhost:3001` in dev.
- Path aliases: `@/` maps to `./src/`, `@api/` maps to `../api/src/` (type imports only).

**ElevenLabs agent config** — `agent_configs/Sayso-Intake.json` contains the full ElevenLabs agent configuration (voice, TTS, ASR, tools). The agent ID is `agent_6501knsjznw3exbacwqn0xpp4qxc`.

**Auth**: Clerk handles authentication. Frontend uses `@clerk/clerk-react`, API uses `@clerk/backend` for JWT verification. Forms are scoped to the authenticated user via `userId` column. Public routes (form view, response submission) don't require auth.

**Dual form systems**: Forms exist both as hardcoded data in `web/src/data/forms.ts` (used by the current UI) and as a DB-backed CRUD API. The frontend currently uses hardcoded forms; the DB API is ready but not yet wired to the UI.

## Commands

```bash
# Install dependencies
pnpm install

# Dev (all three services via Turborepo)
pnpm dev

# Dev individual services
pnpm dev:landing      # Astro on :4321
pnpm dev:web          # Vite on :5173
pnpm dev:api          # tsx watch on :3001

# Type check
pnpm type-check       # type-check both workspaces (cached by Turborepo)

# Build
pnpm build            # builds both web and api

# Database (requires DATABASE_URL in api/.env)
pnpm --filter api db:generate   # generate Drizzle migrations
pnpm --filter api db:migrate    # run migrations
pnpm --filter api db:push       # push schema directly (dev)
pnpm --filter api db:studio     # Drizzle Studio UI
pnpm --filter api db:seed       # seed data
```

## Environment

Copy `api/.env.example` to `api/.env`. Required vars:
- `ELEVENLABS_API_KEY` — needed for voice sessions
- `ELEVENLABS_AGENT_ID` — default agent (already set in example)
- `DATABASE_URL` — Neon Postgres connection string (optional, only for forms/responses CRUD)
- `CLERK_SECRET_KEY` — Clerk secret key for JWT verification (required for auth)
- `PORT` — API port (default 3001)

Copy `web/.env.example` to `web/.env`:
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key for frontend auth

Copy `landing/.env.example` to `landing/.env`:
- `PUBLIC_APP_URL` — URL of the React app (default `http://localhost:5173`, production e.g. `https://app.sayso.com`)

## Brand & Design System

Full brand guidelines live in `BRAND.md`. Below are the rules Claude must follow when writing UI code or copy.

### Two Visual Modes — Never Mix Them

1. **Editorial (landing site)**: Black/white only. No cream, no coral. High-contrast, typographic, magazine-like. This is the public marketing face.
2. **Product (web app)**: Cream (`#FFF8F0`) background, coral (`#FF6B5A`) accents. Warmer, functional. This is where users work.

### Colors (Tailwind v4 `@theme` tokens)

| Token | Hex | Where |
|-------|-----|-------|
| `cream` | `#FFF8F0` | App background only |
| `coral` | `#FF6B5A` | App interactive accents |
| `coral-light` | `#FF8A7A` | Hover on coral |
| `coral-dark` | `#E5554A` | Pressed on coral |
| `black` / `white` | — | Landing page, text, borders |

Use Tailwind opacity modifiers for tints: `black/60` (secondary text), `black/10` (borders), etc.

### Typography

- **Display**: Fraunces (serif) — headings, hero text, emphasis. Use `font-display`.
- **Body**: DM Sans (sans-serif) — body text, UI, buttons. Use `font-body`.
- Emphasis in headings: `<em className="italic">` (Fraunces italic), never bold.
- Kickers/labels: `text-[10px] uppercase tracking-[0.28em] text-black/50`, prefixed with `§` or `●`.
- Body text color: `#231f1b` (warm dark), not pure black.

### Copy & Tone

- Short, declarative sentences. No filler words (just, simply, easily, seamlessly).
- Headlines: lowercase, punchy. Italic for the key word.
- CTAs: action-first ("Try a live demo"), never "Learn more" or "Click here".
- Don't oversell. "Respondents talk. You get structured data." — not "Revolutionary AI solution."

### Components

- **Buttons**: Always `rounded-full` (pill). Primary = black bg + white text + `→` arrow. No coral buttons on landing.
- **Cards**: `rounded-[2rem]` or `rounded-[2.5rem]`, `border border-black`. Hard drop shadow: `shadow-[16px_16px_0_0_rgba(0,0,0,1)]`. No soft/blurry shadows.
- **Icons**: Use typographic symbols (`→`, `✦`, `●`, `§`), not icon libraries.
- **Layout**: `max-w-[1600px] px-8` container. Sections use `py-32` vertical spacing.

### Motion (Framer Motion)

- Default ease: `[0.22, 1, 0.36, 1]`.
- Reveal on scroll: `initial={{ opacity: 0, y: 40 }}`, `once: true`.
- Stagger: `delay: i * 0.08` to `i * 0.15`.
- Logo dot pulse: `scale [1, 1.4, 1]`, 1.8s.
- Never `ease-in`. Always custom bezier or `easeInOut`.

### Logo

Wordmark "sayso" in Fraunces semibold + animated pulse dot. Always lowercase, always monochrome. See `BRAND.md` for full spec.

## Deployment

- **Landing**: Vercel project, root directory `landing/`, framework Astro. Root domain (e.g. `sayso.com`).
- **Web app**: Vercel project, root directory `web/`, framework Vite. Subdomain (e.g. `app.sayso.com`).
- **API**: Railway.

Each Vercel project points at the same repo with a different root directory. `vercel.json` exists in both `landing/` and root (for web).

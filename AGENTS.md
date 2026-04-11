# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What is Sayso

Sayso is a voice-first form builder. Instead of typing, respondents talk to an ElevenLabs voice agent that guides them through form questions conversationally. Answers are captured as structured data via client-side tools.

## Architecture

Turborepo monorepo with two pnpm workspaces: `web/` (React frontend) and `api/` (Hono backend).

**API (`api/`)** — Hono server on Node (`@hono/node-server`), TypeScript, runs on port 3001.
- `src/routes/elevenlabs.ts` — Proxies signed URL requests to ElevenLabs API (keeps API key server-side).
- `src/routes/forms.ts` — CRUD for forms (looked up by slug). Auth required for create/list/update/delete; GET by slug is public.
- `src/routes/responses.ts` — Submit/list responses nested under `/forms/:slug/responses`. Submit is public; listing requires auth (owner only).
- `src/middleware/auth.ts` — Clerk JWT verification middleware. Extracts `userId` from Bearer token.
- `src/db/` — Drizzle ORM with Neon Postgres. Schema in `schema.ts`. Forms have a `userId` column for ownership. DB is optional: if `DATABASE_URL` is unset, only ElevenLabs routes work (forms/responses return 503).
- All routes are mounted under `/api` (e.g. `/api/elevenlabs/token`, `/api/forms`).
- Routes use method chaining for Hono RPC type inference. `AppType` is exported from `src/index.ts` for the frontend client.

**Web (`web/`)** — React 19 + Vite + Tailwind v4 + React Router v7 + Clerk auth.
- `src/pages/FormView.tsx` — Main voice form page (public). Uses `@elevenlabs/react`.
- `src/pages/Landing.tsx` — Marketing landing page with framer-motion animations (public).
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

# Dev (both web + api via Turborepo)
pnpm dev

# Dev individual services
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

## Design System

- Fonts: Fraunces (display/headings), DM Sans (body)
- Colors: `cream` (#FFF8F0), `coral` (#FF6B5A), `coral-light`, `coral-dark`
- Tailwind v4 with `@theme` block in `web/src/index.css`
- Landing page uses black/white editorial style; form page uses cream/coral palette

## Deployment

Frontend: Vercel (config in `vercel.json`). API: Railway.

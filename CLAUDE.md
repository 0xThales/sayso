# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Sayso

Sayso is a voice-first form builder. Instead of typing, respondents talk to an ElevenLabs voice agent that guides them through form questions conversationally. Answers are captured as structured data via client-side tools.

## Architecture

Monorepo with two pnpm workspaces: `web/` (React frontend) and `api/` (Hono backend).

**API (`api/`)** — Hono server on Node (`@hono/node-server`), TypeScript, runs on port 3001.
- `src/routes/elevenlabs.ts` — Proxies signed URL requests to ElevenLabs API (keeps API key server-side).
- `src/routes/forms.ts` — CRUD for forms (looked up by slug).
- `src/routes/responses.ts` — Submit/list responses nested under `/forms/:slug/responses`.
- `src/db/` — Drizzle ORM with Neon Postgres. Schema in `schema.ts`. DB is optional: if `DATABASE_URL` is unset, only ElevenLabs routes work (forms/responses return 503).
- All routes are mounted under `/api` (e.g. `/api/elevenlabs/token`, `/api/forms`).

**Web (`web/`)** — React 19 + Vite + Tailwind v4 + React Router v7.
- `src/pages/FormView.tsx` — Main voice form page. Uses `@elevenlabs/react` (`ConversationProvider`, `useConversation`, `useConversationClientTool`). The agent calls client tools (`save_form_answer`, `complete_form`) to save answers into React state.
- `src/pages/Landing.tsx` — Marketing landing page with framer-motion animations.
- `src/data/forms.ts` — Hardcoded form definitions + `buildAgentPrompt()` which constructs the system prompt sent to the ElevenLabs agent.
- `src/lib/elevenlabs.ts` — Fetches signed URL from the API.
- Vite proxies `/api` to `localhost:3001` in dev.
- Path alias: `@/` maps to `./src/`.

**ElevenLabs agent config** — `agent_configs/Sayso-Intake.json` contains the full ElevenLabs agent configuration (voice, TTS, ASR, tools). The agent ID is `agent_6501knsjznw3exbacwqn0xpp4qxc`.

**Dual form systems**: Forms exist both as hardcoded data in `web/src/data/forms.ts` (used by the current UI) and as a DB-backed CRUD API. The frontend currently uses hardcoded forms; the DB API is ready but not yet wired to the UI.

## Commands

```bash
# Install dependencies
pnpm install

# Dev (both web + api concurrently)
pnpm dev

# Dev individual services
pnpm dev:web          # Vite on :5173
pnpm dev:api          # tsx watch on :3001

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
- `PORT` — API port (default 3001)

## Design System

- Fonts: Fraunces (display/headings), DM Sans (body)
- Colors: `cream` (#FFF8F0), `coral` (#FF6B5A), `coral-light`, `coral-dark`
- Tailwind v4 with `@theme` block in `web/src/index.css`
- Landing page uses black/white editorial style; form page uses cream/coral palette

## Deployment

Vercel config in `vercel.json` — builds the `web/` Vite app. The API would need separate deployment.

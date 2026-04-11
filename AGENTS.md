# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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

**Webhooks (`api/src/routes/webhooks.ts`)** — Receives ElevenLabs post-call webhooks at `/api/webhooks/elevenlabs`. Persists transcripts, evaluation results, and metadata to the `conversations` table. HMAC signature verification via `ELEVENLABS_WEBHOOK_SECRET`.

**ElevenLabs agent config** — `agent_configs/Sayso-Intake.json` contains the full ElevenLabs agent configuration (voice, TTS, ASR, tools). The agent ID is `agent_6501knsjznw3exbacwqn0xpp4qxc`.

**Voice agents** — Two voice personalities (selected in `AgentSelect.tsx`):
- **Nadhi** (voice `cjVigY5qzO86Huf0OWal`) — warm, curious, gentle follow-ups.
- **Tim** (voice `TX3LPaxmHKxFdv7VOQHJ`) — direct, witty, efficient.

Voice ID is stored per form (`voiceId` column) and passed as TTS override at session start. Personality prompts are defined in `web/src/lib/prompt.ts` (`VOICE_PERSONALITIES` map) and injected into both creator and respondent agent prompts.

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
- `ELEVENLABS_WEBHOOK_SECRET` — HMAC secret for post-call webhook verification
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

## Observability & Debugging

Three layers of observability are linked by a shared `conversationId` (generated by ElevenLabs on connect):

| Layer | What it captures | Where | Key field |
|-------|-----------------|-------|-----------|
| **Langfuse** | Client-side trace: tool calls, errors, timing | `cloud.langfuse.com` | `sessionId` = conversationId |
| **conversations** table | Full transcript, 6 evaluation criteria results, summary, duration | Neon DB | `conversation_id` |
| **responses** table | Structured form answers | Neon DB | `conversation_id` |

### Debugging a failed conversation

When a conversation doesn't produce a completed response:

1. **Find the conversationId** — check Langfuse or query `conversations` table.
2. **Check evaluations** — `SELECT evaluation FROM conversations WHERE conversation_id = '...'` shows 6 criteria results (`success`/`failure`/`unknown` + rationale):
   - `all_fields_collected` — were all required fields answered?
   - `answers_are_clear` — were answers specific and usable?
   - `form_completed` — was `complete_form` tool called?
   - `natural_conversation` — did the agent behave naturally?
   - `user_not_frustrated` — was the user comfortable?
   - `language_compliance` — did the agent stay in English?
3. **Read the transcript** — `SELECT transcript FROM conversations WHERE conversation_id = '...'` has the full exchange.
4. **Check Langfuse** — filter by sessionId to see client-side tool calls, errors, and timing.
5. **Cross-reference** — if `conversations` exists but `responses` doesn't for a given conversationId, the conversation happened but the form was never submitted (user dropped, tool failed, etc.).

### ElevenLabs agent management

The agent can be configured via API (no dashboard needed):

```bash
# Get current config
curl -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/convai/agents/agent_6501knsjznw3exbacwqn0xpp4qxc"

# Update config (PATCH — only send fields to change)
curl -X PATCH -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
  "https://api.elevenlabs.io/v1/convai/agents/agent_6501knsjznw3exbacwqn0xpp4qxc" \
  -d '{ "platform_settings": { ... } }'
```

## Deployment

Frontend: Vercel (config in `vercel.json`). API: Railway.

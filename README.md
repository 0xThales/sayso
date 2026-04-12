# sayso

Voice-first form builder. Respondents talk to an ElevenLabs voice agent that guides them through questions conversationally. Answers are captured as structured data.

> Respondents talk. You get structured data.

**Project tracking:** [Linear — Sayso](https://linear.app/nakama-ai/project/sayso-c7b31292d588)

## Monorepo

Turborepo with three pnpm workspaces:

- **`landing/`** — Astro 5 marketing site (editorial, black/white). Deployed to Vercel on the root domain.
- **`web/`** — React 19 + Vite + React Router v7 app (cream/coral product UI). Dashboard, form editor, and the voice form view. Deployed to Vercel on a subdomain.
- **`api/`** — Hono server on Node, Drizzle + Neon Postgres, Clerk JWT auth. Deployed to Railway.

## Stack

- **Frontend:** React 19, Astro 5, Tailwind v4, Framer Motion, Clerk
- **Backend:** Hono, Drizzle ORM, Neon Postgres, Clerk (`@clerk/backend`)
- **Voice:** ElevenLabs Conversational AI (`@elevenlabs/react`)
- **Observability:** Langfuse (client traces) + `conversations` table (transcripts + evaluations)
- **Tooling:** pnpm, Turborepo, TypeScript, Hono RPC (type-safe API client)

## Voice agents

Two personalities, selectable per form:

- **Nadhi** — warm, curious, gentle follow-ups
- **Tim** — direct, witty, efficient

Personality prompts live in `web/src/lib/prompt.ts`. Full agent config is in `agent_configs/Sayso-Intake.json`.

## Commands

```bash
pnpm install

# Dev (all three services)
pnpm dev

# Individual services
pnpm dev:landing   # Astro    :4321
pnpm dev:web       # Vite     :5173
pnpm dev:api       # Hono     :3001

pnpm type-check
pnpm build

# Database
pnpm --filter api db:generate
pnpm --filter api db:migrate
pnpm --filter api db:push
pnpm --filter api db:studio
pnpm --filter api db:seed
```

## Environment

Copy the `.env.example` file in each workspace.

**`api/.env`**
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID`
- `ELEVENLABS_WEBHOOK_SECRET`
- `DATABASE_URL` (Neon — optional; forms/responses routes return 503 without it)
- `CLERK_SECRET_KEY`
- `PORT` (default `3001`)

**`web/.env`**
- `VITE_CLERK_PUBLISHABLE_KEY`

**`landing/.env`**
- `PUBLIC_APP_URL` (e.g. `https://app.sayso.com`)

## Observability

Three layers linked by a shared `conversationId`:

| Layer | Captures | Where |
|---|---|---|
| Langfuse | Tool calls, errors, timing | `cloud.langfuse.com` |
| `conversations` table | Transcript, 6 evaluation criteria, summary | Neon |
| `responses` table | Structured form answers | Neon |

If `conversations` has a row but `responses` doesn't, the call happened but the form was never submitted.

## Brand

Two visual modes — never mixed:

- **Editorial** (landing) — black/white, Fraunces + DM Sans, high-contrast, magazine-like
- **Product** (web) — cream `#FFF8F0` + coral `#FF6B5A`, warmer, functional

Full guidelines in [`BRAND.md`](./BRAND.md). UI rules in [`CLAUDE.md`](./CLAUDE.md).

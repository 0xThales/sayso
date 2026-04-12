import { serve } from "@hono/node-server";
import { Hono, type MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import "dotenv/config";

import { createDb, type Db } from "./db/index.js";
import { elevenlabs } from "./routes/elevenlabs.js";
import { forms } from "./routes/forms.js";
import { invites } from "./routes/invites.js";
import { responses } from "./routes/responses.js";
import { webhooks } from "./routes/webhooks.js";

type Env = { Variables: { db: Db } };

const DEFAULT_PORT = 3001;
const db = process.env.DATABASE_URL ? createDb() : null;

const requireDb: MiddlewareHandler<Env> = async (c, next) => {
  if (!db) {
    return c.json(
      {
        error:
          "Database not configured. Set DATABASE_URL to use forms and responses routes.",
      },
      503,
    );
  }

  c.set("db", db as Db);
  await next();
};

// ── App (chained for Hono RPC type export) ──────────────────────────────────

const api = new Hono<Env>()
  .use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return "*";
        if (origin.includes("localhost")) return origin;
        if (origin.endsWith(".vercel.app")) return origin;
        return null as unknown as string;
      },
    }),
  )
  .get("/health", (c) => c.json({ status: "ok" }))
  .use("/forms", requireDb)
  .use("/forms/*", requireDb)
  .use("/webhooks/*", async (c, next) => {
    if (db) c.set("db", db as Db);
    await next();
  })
  .route("/elevenlabs", elevenlabs)
  .route("/forms", forms)
  .route("/forms", invites)
  .route("/forms", responses)
  .route("/webhooks", webhooks);

const app = new Hono().route("/api", api);

export type AppType = typeof app;

// ── Start ───────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? DEFAULT_PORT);

if (!db) {
  console.warn(
    "DATABASE_URL is not set. ElevenLabs routes are available, but forms/responses routes will return 503.",
  );
}

serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`API running on http://0.0.0.0:${info.port}`);
});

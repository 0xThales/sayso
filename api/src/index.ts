import { serve } from "@hono/node-server";
import { Hono, type MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import "dotenv/config";

import { createDb, type Db } from "./db/index.js";
import { elevenlabs } from "./routes/elevenlabs.js";
import { forms } from "./routes/forms.js";
import { responses } from "./routes/responses.js";

type Env = { Variables: { db: Db } };

const app = new Hono<Env>();
const api = new Hono<Env>();
const DEFAULT_PORT = 3001;
const db = process.env.DATABASE_URL ? createDb() : null;

// Middleware
api.use("*", cors());

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

// Routes
api.get("/health", (c) => c.json({ status: "ok" }));
api.route("/elevenlabs", elevenlabs);
api.use("/forms", requireDb);
api.use("/forms/*", requireDb);
api.route("/forms", forms);
api.route("/forms", responses);

app.route("/api", api);

// Start
const port = Number(process.env.PORT ?? DEFAULT_PORT);

if (!db) {
  console.warn(
    "DATABASE_URL is not set. ElevenLabs routes are available, but forms/responses routes will return 503.",
  );
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API running on http://localhost:${info.port}`);
});

import { serve } from "@hono/node-server";
import { Hono } from "hono";
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

// Middleware
api.use("*", cors());

// Inject DB into context
const db = createDb();
api.use("*", async (c, next) => {
  c.set("db", db);
  await next();
});

// Routes
api.get("/health", (c) => c.json({ status: "ok" }));
api.route("/elevenlabs", elevenlabs);
api.route("/forms", forms);
api.route("/forms", responses);

app.route("/api", api);

// Start
const port = Number(process.env.PORT ?? DEFAULT_PORT);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API running on http://localhost:${info.port}`);
});

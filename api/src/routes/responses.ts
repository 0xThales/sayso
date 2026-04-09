import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { schema } from "../db/index.js";

type Env = { Variables: { db: Db } };

const responses = new Hono<Env>();

// ── GET /forms/:slug/responses — List responses for a form ──────────────────

responses.get("/:slug/responses", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");

  // Resolve form by slug
  const [form] = await db
    .select({ id: schema.forms.id })
    .from(schema.forms)
    .where(eq(schema.forms.slug, slug))
    .limit(1);

  if (!form) return c.json({ error: "Form not found" }, 404);

  const rows = await db
    .select()
    .from(schema.responses)
    .where(eq(schema.responses.formId, form.id))
    .orderBy(desc(schema.responses.createdAt));

  return c.json(rows);
});

// ── POST /forms/:slug/responses — Submit a response ─────────────────────────

responses.post("/:slug/responses", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");

  const [form] = await db
    .select({ id: schema.forms.id })
    .from(schema.forms)
    .where(eq(schema.forms.slug, slug))
    .limit(1);

  if (!form) return c.json({ error: "Form not found" }, 404);

  const body = await c.req.json<{
    answers: Record<string, unknown>;
    completed?: boolean;
    duration?: number;
  }>();

  const [response] = await db
    .insert(schema.responses)
    .values({
      formId: form.id,
      answers: body.answers,
      completed: body.completed ?? true,
      completedAt: body.completed !== false ? new Date() : null,
      duration: body.duration,
    })
    .returning();

  return c.json(response, 201);
});

export { responses };

import { Hono } from "hono";
import { eq, desc, and } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { schema } from "../db/index.js";
import { clerkAuth } from "../middleware/auth.js";

type Env = { Variables: { db: Db; userId: string } };

const responses = new Hono<Env>();

// ── POST /forms/:slug/responses — Submit a response (PUBLIC) ───────────────

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

// ── GET /forms/:slug/responses — List responses (owner only) ───────────────

responses.get("/:slug/responses", clerkAuth, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const slug = c.req.param("slug");

  // Verify form exists AND belongs to the authenticated user
  const [form] = await db
    .select({ id: schema.forms.id })
    .from(schema.forms)
    .where(and(eq(schema.forms.slug, slug), eq(schema.forms.userId, userId)))
    .limit(1);

  if (!form) return c.json({ error: "Form not found" }, 404);

  const rows = await db
    .select()
    .from(schema.responses)
    .where(eq(schema.responses.formId, form.id))
    .orderBy(desc(schema.responses.createdAt));

  return c.json(rows);
});

export { responses };

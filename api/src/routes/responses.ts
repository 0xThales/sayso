import { Hono } from "hono";
import { eq, desc, and } from "drizzle-orm";
import { streamSSE } from "hono/streaming";
import type { Db } from "../db/index.js";
import { schema } from "../db/index.js";
import { clerkAuth } from "../middleware/auth.js";
import {
  publishFormResponseCreated,
  publishFormResponseUpdated,
  subscribeToFormResponses,
} from "../realtime/responses.js";

type Env = { Variables: { db: Db; userId: string } };

const responses = new Hono<Env>();

function buildCompletedAt(completed: boolean | undefined, fallback: Date | null) {
  if (completed === true) return new Date();
  if (completed === false) return null;
  return fallback;
}

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

  await publishFormResponseCreated(form.id, response);

  return c.json(response, 201);
});

// ── PATCH /forms/:slug/responses/:responseId — Update a draft (PUBLIC) ─────

responses.patch("/:slug/responses/:responseId", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");
  const responseId = c.req.param("responseId");

  const [form] = await db
    .select({ id: schema.forms.id })
    .from(schema.forms)
    .where(eq(schema.forms.slug, slug))
    .limit(1);

  if (!form) return c.json({ error: "Form not found" }, 404);

  const [existingResponse] = await db
    .select({
      id: schema.responses.id,
      completedAt: schema.responses.completedAt,
    })
    .from(schema.responses)
    .where(
      and(
        eq(schema.responses.id, responseId),
        eq(schema.responses.formId, form.id),
      ),
    )
    .limit(1);

  if (!existingResponse) return c.json({ error: "Response not found" }, 404);

  const body = await c.req.json<{
    answers: Record<string, unknown>;
    completed?: boolean;
    duration?: number;
  }>();

  const [response] = await db
    .update(schema.responses)
    .set({
      answers: body.answers,
      completed: body.completed ?? false,
      completedAt: buildCompletedAt(body.completed, existingResponse.completedAt),
      duration: body.duration,
    })
    .where(
      and(
        eq(schema.responses.id, responseId),
        eq(schema.responses.formId, form.id),
      ),
    )
    .returning();

  await publishFormResponseUpdated(form.id, response);

  return c.json(response);
});

// ── GET /forms/:slug/responses/stream — Live response events (owner only) ───

responses.get("/:slug/responses/stream", clerkAuth, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const slug = c.req.param("slug");

  const [form] = await db
    .select({ id: schema.forms.id })
    .from(schema.forms)
    .where(and(eq(schema.forms.slug, slug), eq(schema.forms.userId, userId)))
    .limit(1);

  if (!form) return c.json({ error: "Form not found" }, 404);

  return streamSSE(c, async (stream) => {
    let active = true;

    const unsubscribe = subscribeToFormResponses(form.id, async (event) => {
      if (!active) return;
      await stream.writeSSE({
        event: event.type,
        id: event.response.id,
        data: JSON.stringify({
          response: {
            ...event.response,
            createdAt: event.response.createdAt.toISOString(),
            completedAt: event.response.completedAt?.toISOString() ?? null,
          },
        }),
      });
    });

    stream.onAbort(() => {
      active = false;
      unsubscribe();
    });

    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({ ok: true, slug }),
    });

    while (active) {
      await stream.sleep(15000);
      if (!active) break;
      await stream.writeSSE({
        event: "ping",
        data: JSON.stringify({ ts: Date.now() }),
      });
    }
  });
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

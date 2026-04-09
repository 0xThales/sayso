import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "../db/index.js";
import { schema } from "../db/index.js";
import type { FormFieldDef } from "../db/schema.js";
import { clerkAuth } from "../middleware/auth.js";

type Env = { Variables: { db: Db; userId: string } };

const forms = new Hono<Env>();

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function ensureUniqueSlug(db: Db, base: string): Promise<string> {
  let slug = base;
  let attempt = 0;
  while (true) {
    const existing = await db
      .select({ id: schema.forms.id })
      .from(schema.forms)
      .where(eq(schema.forms.slug, slug))
      .limit(1);
    if (existing.length === 0) return slug;
    attempt++;
    slug = `${base}-${nanoid(4)}`;
  }
}

// ── GET /forms/:slug — Public ──────────────────────────────────────────────

forms.get("/:slug", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");

  const [form] = await db
    .select()
    .from(schema.forms)
    .where(eq(schema.forms.slug, slug))
    .limit(1);

  if (!form) return c.json({ error: "Form not found" }, 404);
  return c.json(form);
});

// ── POST /forms — Create (authenticated) ────────────────────────────────────

forms.post("/", clerkAuth, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json<{
    title: string;
    description?: string;
    fields: FormFieldDef[];
    slug?: string;
    voiceId?: string;
    greeting?: string;
    systemContext?: string;
    personality?: string;
    language?: string;
  }>();

  if (!body.title || !body.fields?.length) {
    return c.json({ error: "title and fields are required" }, 400);
  }

  const baseSlug = body.slug ? slugify(body.slug) : slugify(body.title);
  const slug = await ensureUniqueSlug(db, baseSlug);

  const [form] = await db
    .insert(schema.forms)
    .values({
      userId,
      slug,
      title: body.title,
      description: body.description ?? "",
      fields: body.fields,
      voiceId: body.voiceId,
      greeting: body.greeting,
      systemContext: body.systemContext,
      personality: body.personality,
      language: body.language ?? "en",
    })
    .returning();

  return c.json(form, 201);
});

// ── GET /forms — List user's forms (authenticated) ─────────────────────────

forms.get("/", clerkAuth, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const allForms = await db
    .select({
      id: schema.forms.id,
      slug: schema.forms.slug,
      title: schema.forms.title,
      description: schema.forms.description,
      fieldCount: schema.forms.fields,
      language: schema.forms.language,
      createdAt: schema.forms.createdAt,
    })
    .from(schema.forms)
    .where(eq(schema.forms.userId, userId))
    .orderBy(schema.forms.createdAt);

  const result = allForms.map((f) => ({
    ...f,
    fieldCount: Array.isArray(f.fieldCount) ? f.fieldCount.length : 0,
  }));

  return c.json(result);
});

// ── PUT /forms/:id — Update (owner only) ───────────────────────────────────

forms.put("/:id", clerkAuth, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json<{
    title?: string;
    description?: string;
    fields?: FormFieldDef[];
    voiceId?: string;
    greeting?: string;
    systemContext?: string;
    personality?: string;
    language?: string;
  }>();

  const [updated] = await db
    .update(schema.forms)
    .set(body)
    .where(and(eq(schema.forms.id, id), eq(schema.forms.userId, userId)))
    .returning();

  if (!updated) return c.json({ error: "Form not found" }, 404);
  return c.json(updated);
});

// ── DELETE /forms/:id — Delete (owner only) ────────────────────────────────

forms.delete("/:id", clerkAuth, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [deleted] = await db
    .delete(schema.forms)
    .where(and(eq(schema.forms.id, id), eq(schema.forms.userId, userId)))
    .returning({ id: schema.forms.id });

  if (!deleted) return c.json({ error: "Form not found" }, 404);
  return c.json({ ok: true });
});

export { forms };

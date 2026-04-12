import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "../db/index.js";
import { schema } from "../db/index.js";
import { clerkAuth } from "../middleware/auth.js";
import type { FormInvite } from "../db/schema.js";
import {
  buildInviteEmail,
  buildInviteLink,
  normalizeBaseUrl,
  sendInviteEmail,
} from "../lib/invites.js";

type Env = { Variables: { db: Db; userId: string } };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeEmails(input: string[]) {
  const unique = new Set<string>();

  for (const raw of input) {
    const email = raw.trim().toLowerCase();
    if (email) unique.add(email);
  }

  return Array.from(unique);
}

async function findOwnedForm(db: Db, slug: string, userId: string) {
  const [form] = await db
    .select({
      id: schema.forms.id,
      slug: schema.forms.slug,
      title: schema.forms.title,
      description: schema.forms.description,
    })
    .from(schema.forms)
    .where(and(eq(schema.forms.slug, slug), eq(schema.forms.userId, userId)))
    .limit(1);

  return form ?? null;
}

const invites = new Hono<Env>()
  .get("/:slug/invites", clerkAuth, async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const slug = c.req.param("slug");

    const form = await findOwnedForm(db, slug, userId);
    if (!form) return c.json({ error: "Form not found" }, 404);

    const rows = await db
      .select()
      .from(schema.formInvites)
      .where(eq(schema.formInvites.formId, form.id))
      .orderBy(desc(schema.formInvites.createdAt));

    return c.json(rows);
  })
  .post("/:slug/invites", clerkAuth, async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const slug = c.req.param("slug");
    const body = await c.req.json<{ emails?: string[] }>();

    const form = await findOwnedForm(db, slug, userId);
    if (!form) return c.json({ error: "Form not found" }, 404);

    const emails = Array.isArray(body.emails)
      ? normalizeEmails(body.emails)
      : [];
    if (emails.length === 0) {
      return c.json({ error: "At least one email is required" }, 400);
    }

    const invalidEmails = emails.filter((email) => !EMAIL_REGEX.test(email));
    if (invalidEmails.length > 0) {
      return c.json(
        {
          error: `Invalid email address${invalidEmails.length > 1 ? "es" : ""}: ${invalidEmails.join(", ")}`,
        },
        400,
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return c.json(
        {
          error: "Email delivery is not configured. Set RESEND_API_KEY on the API.",
        },
        503,
      );
    }

    const baseUrl = normalizeBaseUrl(process.env.APP_URL ?? c.req.header("origin"));
    if (!baseUrl) {
      return c.json(
        {
          error: "App URL is not configured. Set APP_URL or send the request from the web app.",
        },
        500,
      );
    }

    const from = process.env.RESEND_FROM_EMAIL?.trim() || "Sayso <onboarding@resend.dev>";
    const results: FormInvite[] = [];

    for (const email of emails) {
      const [pendingInvite] = await db
        .insert(schema.formInvites)
        .values({
          formId: form.id,
          email,
          token: nanoid(24),
          status: "pending",
        })
        .returning();

      const invite = pendingInvite!;
      const inviteUrl = buildInviteLink(baseUrl, form.slug, invite.token);
      const emailContent = buildInviteEmail({
        formTitle: form.title,
        formDescription: form.description,
        inviteUrl,
      });

      try {
        const delivery = await sendInviteEmail({
          apiKey: resendApiKey,
          from,
          to: email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });

        const [sentInvite] = await db
          .update(schema.formInvites)
          .set({
            status: "sent",
            sentAt: new Date(),
            providerMessageId: delivery.id,
            error: null,
          })
          .where(eq(schema.formInvites.id, invite.id))
          .returning();

        results.push(sentInvite!);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown email delivery error";

        const [failedInvite] = await db
          .update(schema.formInvites)
          .set({
            status: "failed",
            error: message,
          })
          .where(eq(schema.formInvites.id, invite.id))
          .returning();

        results.push(failedInvite!);
      }
    }

    const sentCount = results.filter((invite) => invite.status !== "failed").length;
    const failedCount = results.length - sentCount;

    return c.json({ invites: results, sentCount, failedCount }, 201);
  })
  .post("/:slug/invites/:token/open", async (c) => {
    const db = c.get("db");
    const slug = c.req.param("slug");
    const token = c.req.param("token");

    const [form] = await db
      .select({ id: schema.forms.id })
      .from(schema.forms)
      .where(eq(schema.forms.slug, slug))
      .limit(1);

    if (!form) return c.json({ error: "Form not found" }, 404);

    const [invite] = await db
      .select()
      .from(schema.formInvites)
      .where(
        and(
          eq(schema.formInvites.formId, form.id),
          eq(schema.formInvites.token, token),
        ),
      )
      .limit(1);

    if (!invite) return c.json({ error: "Invite not found" }, 404);

    const now = new Date();
    const nextStatus = invite.status === "completed" ? "completed" : "opened";

    await db
      .update(schema.formInvites)
      .set({
        status: nextStatus,
        openedAt: invite.openedAt ?? now,
      })
      .where(eq(schema.formInvites.id, invite.id));

    return c.json({ ok: true });
  });

export { invites };

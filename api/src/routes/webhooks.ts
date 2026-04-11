import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "../db/index.js";
import { schema } from "../db/index.js";

// ── Types ───────────────────────────────────────────────────────────────────

type TranscriptEntry = {
  role: "agent" | "user";
  message: string;
  time_in_call_secs?: number;
};

type EvaluationResult = {
  criteria_id: string;
  result: "success" | "failure" | "unknown";
  rationale?: string;
};

type PostCallPayload = {
  type: "post_call_transcription" | "post_call_audio" | "call_initiation_failure";
  event_timestamp?: number;
  agent_id?: string;
  conversation_id?: string;
  status?: string;
  transcript?: TranscriptEntry[];
  conversation_initiation_client_data?: Record<string, unknown>;
  analysis?: {
    evaluation_criteria_results?: Record<string, EvaluationResult>;
    data_collection_results?: Record<string, { value: string; rationale?: string }>;
    call_successful?: string;
    transcript_summary?: string;
  };
  metadata?: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
    cost?: number;
    [key: string]: unknown;
  };
};

// ── HMAC verification ───────────────────────────────────────────────────────

function verifySignature(
  body: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) return false;

  const parts = Object.fromEntries(
    signature.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k, v.join("=")];
    }),
  );

  const timestamp = parts["t"];
  const v0 = parts["v0"];
  if (!timestamp || !v0) return false;

  const payload = `${timestamp}.${body}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(v0), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── Route ───────────────────────────────────────────────────────────────────

type Env = { Variables: { db?: Db } };

const webhooks = new Hono<Env>()

.post("/elevenlabs", async (c) => {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  const rawBody = await c.req.text();

  // Verify HMAC if secret is configured
  if (secret) {
    const sig = c.req.header("elevenlabs-signature");
    if (!verifySignature(rawBody, sig, secret)) {
      console.warn("[webhook] Invalid ElevenLabs signature");
      return c.json({ error: "Invalid signature" }, 401);
    }
  }

  const payload: PostCallPayload = JSON.parse(rawBody);

  if (payload.type === "post_call_transcription") {
    const { conversation_id, agent_id, transcript, analysis, metadata } = payload;

    console.log(
      `[webhook] Post-call transcript`,
      JSON.stringify({
        conversation_id,
        agent_id,
        duration_secs: metadata?.call_duration_secs,
        transcript_turns: transcript?.length,
        evaluation: analysis?.evaluation_criteria_results
          ? Object.fromEntries(
              Object.entries(analysis.evaluation_criteria_results).map(
                ([k, v]) => [k, v.result],
              ),
            )
          : undefined,
        summary: analysis?.transcript_summary,
      }),
    );

    // Persist to DB if available
    const db = c.get("db");
    if (db && conversation_id) {
      try {
        // Try to resolve formId from dynamic variables passed at session start
        const clientData = payload.conversation_initiation_client_data as
          | { form_id?: string }
          | undefined;
        const formId = clientData?.form_id ?? null;

        await db.insert(schema.conversations).values({
          conversationId: conversation_id,
          agentId: agent_id ?? null,
          formId,
          transcript: transcript ?? null,
          evaluation: analysis?.evaluation_criteria_results ?? null,
          summary: analysis?.transcript_summary ?? null,
          durationSecs: metadata?.call_duration_secs
            ? Math.round(metadata.call_duration_secs)
            : null,
          status: payload.status ?? null,
        });

        console.log(`[webhook] Saved conversation ${conversation_id} to DB`);
      } catch (err) {
        console.error("[webhook] Failed to save conversation:", err);
      }
    }
  } else if (payload.type === "call_initiation_failure") {
    console.error("[webhook] Call initiation failed:", JSON.stringify(payload));
  }

  // Must return 200 quickly — ElevenLabs auto-disables after 10 consecutive failures
  return c.json({ ok: true });
});

export { webhooks };

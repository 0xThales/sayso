import { Hono } from "hono";
import { clerkAuth } from "../middleware/auth.js";

const ELEVENLABS_API_BASE =
  process.env.ELEVENLABS_API_BASE ?? "https://api.elevenlabs.io";

type Workflow = "creator" | "response";
type Env = {
  Variables: {
    userId: string;
  };
};

type SignedUrlResponse = {
  signed_url: string;
  conversation_id?: string;
};

type ErrorStatus = 400 | 401 | 403 | 404 | 429 | 500 | 502;

function getElevenLabsConfig() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const defaultAgentId = process.env.ELEVENLABS_AGENT_ID;
  const creatorAgentId = process.env.ELEVENLABS_CREATOR_AGENT_ID;
  const responseAgentId = process.env.ELEVENLABS_RESPONSE_AGENT_ID;
  if (!apiKey) throw new Error("Missing ELEVENLABS_API_KEY");
  return { apiKey, defaultAgentId, creatorAgentId, responseAgentId };
}

async function requestSignedUrl(options: {
  agentId: string;
  includeConversationId?: boolean;
  branchId?: string;
}) {
  const { apiKey } = getElevenLabsConfig();
  const params = new URLSearchParams({ agent_id: options.agentId });

  if (options.includeConversationId)
    params.set("include_conversation_id", "true");
  if (options.branchId) params.set("branch_id", options.branchId);

  const response = await fetch(
    `${ELEVENLABS_API_BASE}/v1/convai/conversation/get-signed-url?${params.toString()}`,
    { method: "GET", headers: { "xi-api-key": apiKey } },
  );

  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      error:
        typeof data.detail === "string"
          ? data.detail
          : typeof data.message === "string"
            ? data.message
            : "Failed to get signed URL from ElevenLabs",
      details: data,
    };
  }

  return { ok: true as const, data: data as SignedUrlResponse };
}

async function handleSignedUrlRequest(
  workflow: Workflow,
  agentId: string | undefined,
  includeConversationId: boolean,
  branchId?: string,
) {
  const { defaultAgentId, creatorAgentId, responseAgentId } = getElevenLabsConfig();
  const workflowAgentId =
    workflow === "creator" ? creatorAgentId : responseAgentId;
  const resolvedAgentId = agentId ?? workflowAgentId ?? defaultAgentId;

  if (!resolvedAgentId) {
    return {
      ok: false as const,
      status: 500,
      error:
        "Missing agent id. Provide ELEVENLABS_AGENT_ID or pass agentId in the request.",
      details: {} as Record<string, unknown>,
    };
  }

  const result = await requestSignedUrl({
    agentId: resolvedAgentId,
    includeConversationId,
    branchId,
  });

  if (!result.ok) return result;

  return {
    ok: true as const,
    workflow,
    agentId: resolvedAgentId,
    data: result.data,
  };
}

function toErrorStatus(status: number): ErrorStatus {
  const valid: ErrorStatus[] = [400, 401, 403, 404, 429, 500];
  return (valid.includes(status as ErrorStatus) ? status : 502) as ErrorStatus;
}

function formatResult(
  result: Awaited<ReturnType<typeof handleSignedUrlRequest>>,
) {
  if (!result.ok) return result;
  return {
    ok: true as const,
    json: {
      workflow: result.workflow,
      agentId: result.agentId,
      signedUrl: result.data.signed_url,
      signed_url: result.data.signed_url,
      conversationId: result.data.conversation_id,
      conversation_id: result.data.conversation_id,
    },
  };
}

type SessionRequestBody = {
  agentId?: string;
  includeConversationId?: boolean;
  branchId?: string;
};

async function parseSessionBody(c: {
  req: {
    json: () => Promise<unknown>;
  };
}) {
  return (await c.req.json().catch(() => ({}))) as SessionRequestBody;
}

const elevenlabs = new Hono<Env>()

.get("/token", async (c) => {
  try {
    const result = formatResult(
      await handleSignedUrlRequest(
        "response",
        c.req.query("agentId") ?? undefined,
        c.req.query("includeConversationId") === "true",
        c.req.query("branchId") ?? undefined,
      ),
    );
    if (!result.ok)
      return c.json(
        {
          error: result.error,
          details: "details" in result ? result.details : undefined,
        },
        toErrorStatus(result.status),
      );
    return c.json(result.json);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected ElevenLabs error";
    return c.json({ error: message }, 500);
  }
})

.post("/conversation/signed-url", async (c) => {
  try {
    const body = await parseSessionBody(c);
    const result = formatResult(
      await handleSignedUrlRequest(
        "response",
        body.agentId,
        Boolean(body.includeConversationId),
        body.branchId,
      ),
    );
    if (!result.ok)
      return c.json(
        {
          error: result.error,
          details: "details" in result ? result.details : undefined,
        },
        toErrorStatus(result.status),
      );
    return c.json(result.json);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected ElevenLabs error";
    return c.json({ error: message }, 500);
  }
})

.post("/session/creator", clerkAuth, async (c) => {
  try {
    const body = await parseSessionBody(c);
    const result = formatResult(
      await handleSignedUrlRequest(
        "creator",
        body.agentId,
        Boolean(body.includeConversationId),
        body.branchId,
      ),
    );
    if (!result.ok)
      return c.json(
        {
          error: result.error,
          details: "details" in result ? result.details : undefined,
        },
        toErrorStatus(result.status),
      );
    return c.json(result.json);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected ElevenLabs error";
    return c.json({ error: message }, 500);
  }
})

.post("/session/response", async (c) => {
  try {
    const body = await parseSessionBody(c);
    const result = formatResult(
      await handleSignedUrlRequest(
        "response",
        body.agentId,
        Boolean(body.includeConversationId),
        body.branchId,
      ),
    );
    if (!result.ok)
      return c.json(
        {
          error: result.error,
          details: "details" in result ? result.details : undefined,
        },
        toErrorStatus(result.status),
      );
    return c.json(result.json);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected ElevenLabs error";
    return c.json({ error: message }, 500);
  }
});

export { elevenlabs };

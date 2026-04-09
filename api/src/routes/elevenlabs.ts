import { Hono } from "hono";

const ELEVENLABS_API_BASE =
  process.env.ELEVENLABS_API_BASE ?? "https://api.elevenlabs.io";

type SignedUrlResponse = {
  signed_url: string;
  conversation_id?: string;
};

type ErrorStatus = 400 | 401 | 403 | 404 | 429 | 500 | 502;

function getElevenLabsConfig() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const defaultAgentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey) throw new Error("Missing ELEVENLABS_API_KEY");
  return { apiKey, defaultAgentId };
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
  agentId: string | undefined,
  includeConversationId: boolean,
  branchId?: string,
) {
  const { defaultAgentId } = getElevenLabsConfig();
  const resolvedAgentId = agentId ?? defaultAgentId;

  if (!resolvedAgentId) {
    return {
      ok: false as const,
      status: 500,
      error:
        "Missing agent id. Provide ELEVENLABS_AGENT_ID or pass agentId in the request.",
      details: {} as Record<string, unknown>,
    };
  }

  return requestSignedUrl({
    agentId: resolvedAgentId,
    includeConversationId,
    branchId,
  });
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
      signedUrl: result.data.signed_url,
      signed_url: result.data.signed_url,
      conversationId: result.data.conversation_id,
      conversation_id: result.data.conversation_id,
    },
  };
}

const elevenlabs = new Hono();

elevenlabs.get("/token", async (c) => {
  try {
    const result = formatResult(
      await handleSignedUrlRequest(
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
});

elevenlabs.post("/conversation/signed-url", async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      agentId?: string;
      includeConversationId?: boolean;
      branchId?: string;
    };
    const result = formatResult(
      await handleSignedUrlRequest(
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

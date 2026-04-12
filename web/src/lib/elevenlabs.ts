import { getAuthHeaders } from "@/lib/api";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type SessionWorkflow = "creator" | "response";

type SessionResponse = {
  signedUrl: string;
  signed_url: string;
  conversationId?: string;
  conversation_id?: string;
  agentId?: string;
  workflow?: SessionWorkflow;
};

async function getSession(
  workflow: SessionWorkflow,
  options?: {
    includeConversationId?: boolean;
    branchId?: string;
  },
): Promise<SessionResponse> {
  const endpoint =
    workflow === "creator"
      ? `${API_BASE}/api/elevenlabs/session/creator`
      : `${API_BASE}/api/elevenlabs/session/response`;
  const legacyEndpoint = `${API_BASE}/api/elevenlabs/conversation/signed-url`;
  const payload = JSON.stringify({
    includeConversationId: options?.includeConversationId,
    branchId: options?.branchId,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(workflow === "creator" ? await getAuthHeaders() : {}),
  };

  let res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: payload,
  });

  // Production can briefly serve a newer web build against an older API deploy.
  // Fall back to the legacy signed-url route when the session endpoints are missing.
  if (res.status === 404) {
    res = await fetch(legacyEndpoint, {
      method: "POST",
      headers,
      body: payload,
    });
  }

  if (!res.ok) {
    const message = await res.text();
    throw new Error(
      `Failed to get ${workflow} session: ${message || res.statusText}`,
    );
  }

  return res.json();
}

export async function getCreatorSignedUrl(): Promise<string> {
  const data = await getSession("creator");
  return data.signedUrl;
}

export async function getResponseSignedUrl(): Promise<string> {
  const data = await getSession("response");
  return data.signedUrl;
}

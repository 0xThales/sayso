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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(workflow === "creator" ? await getAuthHeaders() : {}),
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      includeConversationId: options?.includeConversationId,
      branchId: options?.branchId,
    }),
  });

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

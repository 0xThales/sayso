import type { Form, FormField, FormResponse } from "@/types/forms";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

// ── Auth helper ────────────────────────────────────────────────────────────

let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (_getToken) {
    const token = await _getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// ── Form CRUD ───────────────────────────────────────────────────────────────

export interface FormSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  fieldCount: number;
  language: string;
  createdAt: string;
}

export async function fetchForms(): Promise<FormSummary[]> {
  const res = await fetch(`${API_BASE}/api/forms`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`Failed to load forms: ${res.statusText}`);
  return res.json();
}

export async function fetchForm(slug: string): Promise<Form> {
  const res = await fetch(`${API_BASE}/api/forms/${slug}`);
  if (res.status === 404) throw new FormNotFoundError(slug);
  if (!res.ok) throw new Error(`Failed to load form: ${res.statusText}`);
  return res.json();
}

export async function createForm(data: {
  title: string;
  description?: string;
  fields: FormField[];
  voiceId?: string;
  greeting?: string;
  systemContext?: string;
  personality?: string;
  language?: string;
}): Promise<Form> {
  const res = await fetch("/api/forms", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create form: ${res.statusText}`);
  return res.json();
}

export async function updateForm(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    fields: FormField[];
    voiceId: string;
    greeting: string;
    systemContext: string;
    personality: string;
    language: string;
  }>,
): Promise<Form> {
  const res = await fetch(`${API_BASE}/api/forms/${id}`, {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update form: ${res.statusText}`);
  return res.json();
}

export async function deleteForm(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/forms/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete form: ${res.statusText}`);
}

// ── Responses ───────────────────────────────────────────────────────────────

export async function fetchResponses(slug: string): Promise<FormResponse[]> {
  const res = await fetch(`${API_BASE}/api/forms/${slug}/responses`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to load responses: ${res.statusText}`);
  return res.json();
}

export type ResponseStreamEvent =
  | { type: "connected"; payload: { ok: true; slug: string } }
  | { type: "ping"; payload: { ts: number } }
  | { type: "response.created"; payload: { response: FormResponse } }
  | { type: "response.updated"; payload: { response: FormResponse } };

function parseSseEvent(block: string): ResponseStreamEvent | null {
  const lines = block
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) return null;

  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return null;

  const payload = JSON.parse(dataLines.join("\n")) as unknown;

  if (
    event === "connected" ||
    event === "ping" ||
    event === "response.created" ||
    event === "response.updated"
  ) {
    return { type: event, payload } as ResponseStreamEvent;
  }

  return null;
}

export async function subscribeToResponsesStream(
  slug: string,
  onEvent: (event: ResponseStreamEvent) => void,
): Promise<() => void> {
  const controller = new AbortController();
  const headers = await authHeaders();
  delete headers["Content-Type"];

  const res = await fetch(`${API_BASE}/api/forms/${slug}/responses/stream`, {
    headers,
    signal: controller.signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`Failed to subscribe to responses: ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  void (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let boundaryIndex = buffer.indexOf("\n\n");
        while (boundaryIndex !== -1) {
          const rawEvent = buffer.slice(0, boundaryIndex);
          buffer = buffer.slice(boundaryIndex + 2);
          const event = parseSseEvent(rawEvent);
          if (event) onEvent(event);
          boundaryIndex = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Responses stream closed unexpectedly:", error);
      }
    }
  })();

  return () => controller.abort();
}

export async function createResponse(
  slug: string,
  answers: Record<string, unknown>,
  options?: {
    completed?: boolean;
    duration?: number;
  },
): Promise<FormResponse> {
  const res = await fetch(`${API_BASE}/api/forms/${slug}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      answers,
      completed: options?.completed,
      duration: options?.duration,
    }),
  });
  if (!res.ok) throw new Error(`Failed to create response: ${res.statusText}`);
  return res.json();
}

export async function updateResponse(
  slug: string,
  responseId: string,
  answers: Record<string, unknown>,
  options?: {
    completed?: boolean;
    duration?: number;
  },
): Promise<FormResponse> {
  const res = await fetch(`${API_BASE}/api/forms/${slug}/responses/${responseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      answers,
      completed: options?.completed,
      duration: options?.duration,
    }),
  });
  if (!res.ok) throw new Error(`Failed to update response: ${res.statusText}`);
  return res.json();
}

// ── Errors ──────────────────────────────────────────────────────────────────

export class FormNotFoundError extends Error {
  constructor(slug: string) {
    super(`Form not found: ${slug}`);
    this.name = "FormNotFoundError";
  }
}

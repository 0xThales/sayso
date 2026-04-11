import { hc } from "hono/client";
import type { AppType } from "@api/index";

// ── Client setup ───────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? "";

let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

async function authHeaders(): Promise<Record<string, string>> {
  if (!_getToken) return {};
  const token = await _getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function client() {
  return hc<AppType>(API_BASE);
}

// ── Type re-exports (inferred from the API, no manual duplication) ─────────

// Infer types from the API response — no manual duplication
type InferJson<T> = T extends { json(): Promise<infer U> } ? U : never;

type FormsListResponse = InferJson<Awaited<ReturnType<ReturnType<typeof client>["api"]["forms"]["$get"]>>>;
type FormGetResponse = InferJson<Awaited<ReturnType<ReturnType<typeof client>["api"]["forms"][":slug"]["$get"]>>>;
type ResponsesListResponse = InferJson<Awaited<ReturnType<ReturnType<typeof client>["api"]["forms"][":slug"]["responses"]["$get"]>>>;

export type FormSummary = Extract<FormsListResponse, unknown[]>[number];
export type Form = Extract<FormGetResponse, { slug: string }>;
export type FormResponse = Extract<ResponsesListResponse, unknown[]>[number];

// Re-export field types from the API schema for pages that need them
export type { FormFieldDef as FormField, FieldType } from "@api/db/schema";

// ── Form CRUD ───────────────────────────────────────────────────────────────

export async function fetchForms() {
  const c = client();
  const res = await c.api.forms.$get(undefined as never, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to load forms: ${res.statusText}`);
  return res.json();
}

export async function fetchForm(slug: string) {
  const c = client();
  const res = await c.api.forms[":slug"].$get({
    param: { slug },
  });
  if (res.status === 404) throw new FormNotFoundError(slug);
  if (!res.ok) throw new Error(`Failed to load form: ${res.statusText}`);
  return res.json();
}

export async function createForm(data: {
  title: string;
  description?: string;
  fields: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    description?: string;
    options?: string[];
    validation?: { min?: number; max?: number; pattern?: string };
  }>;
  voiceId?: string;
  greeting?: string;
  systemContext?: string;
  personality?: string;
  language?: string;
}) {
  const c = client();
  // Body types require validators for full inference — cast input for mutations
  const res = await c.api.forms.$post(
    { json: data } as never,
    { headers: await authHeaders() },
  );
  if (!res.ok) throw new Error(`Failed to create form: ${res.statusText}`);
  return res.json();
}

export async function updateForm(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    fields: Array<{
      id: string;
      label: string;
      type: string;
      required: boolean;
      description?: string;
      options?: string[];
      validation?: { min?: number; max?: number; pattern?: string };
    }>;
    voiceId: string;
    greeting: string;
    systemContext: string;
    personality: string;
    language: string;
  }>,
) {
  const c = client();
  const res = await c.api.forms[":id"].$put(
    { param: { id }, json: data } as never,
    { headers: await authHeaders() },
  );
  if (!res.ok) throw new Error(`Failed to update form: ${res.statusText}`);
  return res.json();
}

export async function deleteForm(id: string) {
  const c = client();
  const res = await c.api.forms[":id"].$delete(
    { param: { id } },
    { headers: await authHeaders() },
  );
  if (!res.ok) throw new Error(`Failed to delete form: ${res.statusText}`);
}

// ── Responses ───────────────────────────────────────────────────────────────

export async function fetchResponses(slug: string) {
  const c = client();
  const res = await c.api.forms[":slug"].responses.$get(
    { param: { slug } },
    { headers: await authHeaders() },
  );
  if (!res.ok) throw new Error(`Failed to load responses: ${res.statusText}`);
  return res.json();
}

export async function createResponse(
  slug: string,
  answers: Record<string, unknown>,
  options?: {
    completed?: boolean;
    duration?: number;
    conversationId?: string;
  },
) {
  const c = client();
  const res = await c.api.forms[":slug"].responses.$post({
    param: { slug },
    json: {
      answers,
      completed: options?.completed,
      duration: options?.duration,
      conversationId: options?.conversationId,
    },
  } as never);
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
) {
  const c = client();
  const res = await c.api.forms[":slug"].responses[":responseId"].$patch({
    param: { slug, responseId },
    json: {
      answers,
      completed: options?.completed,
      duration: options?.duration,
    },
  } as never);
  if (!res.ok) throw new Error(`Failed to update response: ${res.statusText}`);
  return res.json();
}

// ── SSE streaming (manual — hono/client doesn't handle SSE consumption) ────

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

// ── Errors ──────────────────────────────────────────────────────────────────

export class FormNotFoundError extends Error {
  constructor(slug: string) {
    super(`Form not found: ${slug}`);
    this.name = "FormNotFoundError";
  }
}

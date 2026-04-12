// ── Shared frontend API types ──────────────────────────────────────────────

export type FieldType =
  | "text"
  | "long_text"
  | "number"
  | "boolean"
  | "enum"
  | "multi_select"
  | "email"
  | "date"
  | "scale"
  | "file";

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  description?: string;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface FormSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  fieldCount: number;
  language: string;
  createdAt: string;
}

export interface Form {
  id: string;
  userId?: string | null;
  slug: string;
  title: string;
  description: string;
  fields: FormField[];
  voiceId?: string | null;
  greeting?: string | null;
  systemContext?: string | null;
  personality?: string | null;
  language: string;
  createdAt: string;
}

export interface FormResponse {
  id: string;
  formId: string;
  conversationId?: string | null;
  answers: Record<string, unknown>;
  completed: boolean;
  completedAt: string | null;
  duration: number | null;
  createdAt: string;
}

type FormInput = {
  title: string;
  description?: string;
  fields: FormField[];
  voiceId?: string;
  greeting?: string;
  systemContext?: string;
  personality?: string;
  language?: string;
};

type FormUpdateInput = Partial<FormInput>;

type ResponseInputOptions = {
  completed?: boolean;
  duration?: number;
  conversationId?: string;
};

// ── Client setup ───────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? "";

let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!_getToken) return {};
  const token = await _getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function apiUrl(path: string) {
  return `${API_BASE}/api${path}`;
}

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const data = (await res.json()) as unknown;
    if (
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string" &&
      data.error.trim()
    ) {
      return data.error;
    }
  } catch {
    // Ignore JSON parsing failures and fall back to status text.
  }

  return res.statusText || fallback;
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  fallbackError = "Request failed",
): Promise<T> {
  const res = await fetch(apiUrl(path), init);
  if (!res.ok) {
    const message = await readErrorMessage(res, fallbackError);
    throw new Error(message);
  }
  return (await res.json()) as T;
}

// ── Form CRUD ──────────────────────────────────────────────────────────────

export async function fetchForms() {
  return requestJson<FormSummary[]>(
    "/forms",
    {
      headers: await getAuthHeaders(),
    },
    "Failed to load forms",
  );
}

export async function fetchForm(slug: string) {
  const res = await fetch(apiUrl(`/forms/${slug}`));

  if (res.status === 404) throw new FormNotFoundError(slug);
  if (!res.ok) {
    const message = await readErrorMessage(res, "Failed to load form");
    throw new Error(message);
  }

  return (await res.json()) as Form;
}

export async function createForm(data: FormInput) {
  return requestJson<Form>(
    "/forms",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify(data),
    },
    "Failed to create form",
  );
}

export async function updateForm(id: string, data: FormUpdateInput) {
  return requestJson<Form>(
    `/forms/${id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify(data),
    },
    "Failed to update form",
  );
}

export async function deleteForm(id: string) {
  await requestJson<{ ok: true }>(
    `/forms/${id}`,
    {
      method: "DELETE",
      headers: await getAuthHeaders(),
    },
    "Failed to delete form",
  );
}

// ── Responses ──────────────────────────────────────────────────────────────

export async function fetchResponses(slug: string) {
  return requestJson<FormResponse[]>(
    `/forms/${slug}/responses`,
    {
      headers: await getAuthHeaders(),
    },
    "Failed to load responses",
  );
}

export async function createResponse(
  slug: string,
  answers: Record<string, unknown>,
  options?: ResponseInputOptions,
) {
  return requestJson<FormResponse>(
    `/forms/${slug}/responses`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        answers,
        completed: options?.completed,
        duration: options?.duration,
        conversationId: options?.conversationId,
      }),
    },
    "Failed to create response",
  );
}

export async function updateResponse(
  slug: string,
  responseId: string,
  answers: Record<string, unknown>,
  options?: Omit<ResponseInputOptions, "conversationId">,
) {
  return requestJson<FormResponse>(
    `/forms/${slug}/responses/${responseId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        answers,
        completed: options?.completed,
        duration: options?.duration,
      }),
    },
    "Failed to update response",
  );
}

// ── SSE streaming ──────────────────────────────────────────────────────────

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
  const headers = await getAuthHeaders();

  const res = await fetch(apiUrl(`/forms/${slug}/responses/stream`), {
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

// ── Errors ─────────────────────────────────────────────────────────────────

export class FormNotFoundError extends Error {
  constructor(slug: string) {
    super(`Form not found: ${slug}`);
    this.name = "FormNotFoundError";
  }
}

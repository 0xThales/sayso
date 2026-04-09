import type { Form, FormField, FormResponse } from "@/types/forms";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

// ── Auth helper ────────────────────────────────────────────────────────────

let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

async function authHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
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

export async function submitResponse(
  slug: string,
  answers: Record<string, unknown>,
  duration: number,
): Promise<FormResponse> {
  const res = await fetch(`${API_BASE}/api/forms/${slug}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers, completed: true, duration }),
  });
  if (!res.ok) throw new Error(`Failed to submit response: ${res.statusText}`);
  return res.json();
}

// ── Errors ──────────────────────────────────────────────────────────────────

export class FormNotFoundError extends Error {
  constructor(slug: string) {
    super(`Form not found: ${slug}`);
    this.name = "FormNotFoundError";
  }
}

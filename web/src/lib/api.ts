import type { Form, FormResponse } from "@/types/forms";

export async function fetchForm(slug: string): Promise<Form> {
  const res = await fetch(`/api/forms/${slug}`);
  if (res.status === 404) throw new FormNotFoundError(slug);
  if (!res.ok) throw new Error(`Failed to load form: ${res.statusText}`);
  return res.json();
}

export async function submitResponse(
  slug: string,
  answers: Record<string, unknown>,
  duration: number,
): Promise<FormResponse> {
  const res = await fetch(`/api/forms/${slug}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers, completed: true, duration }),
  });
  if (!res.ok) throw new Error(`Failed to submit response: ${res.statusText}`);
  return res.json();
}

export class FormNotFoundError extends Error {
  constructor(slug: string) {
    super(`Form not found: ${slug}`);
    this.name = "FormNotFoundError";
  }
}

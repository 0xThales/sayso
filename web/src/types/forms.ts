// ── Field types ──────────────────────────────────────────────────────────────

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

export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
}

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  description?: string;
  options?: string[];
  validation?: FieldValidation;
}

// ── Form ─────────────────────────────────────────────────────────────────────

export interface Form {
  id: string;
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

// ── Response ─────────────────────────────────────────────────────────────────

export interface FormResponse {
  id: string;
  formId: string;
  answers: Record<string, unknown>;
  completed: boolean;
  completedAt?: string | null;
  duration?: number | null;
  createdAt: string;
}

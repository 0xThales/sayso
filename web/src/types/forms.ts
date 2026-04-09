export interface FormField {
  id: string;
  label: string;
  type: "text" | "number" | "email" | "choice" | "open";
  required: boolean;
  options?: string[];
}

export interface FormConfig {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  voiceId?: string;
  greeting?: string;
}

export interface FormResponse {
  formId: string;
  answers: Record<string, string>;
  completedAt: string;
}

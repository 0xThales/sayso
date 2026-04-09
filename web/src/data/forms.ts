import type { FormConfig } from "@/types/forms";

export const forms: Record<string, FormConfig> = {
  founder_fit: {
    id: "founder_fit",
    title: "Founder Fit Call",
    description:
      "A voice-native intake that feels more like a calm producer than a cold lead form.",
    greeting:
      "Hi, welcome to Sayso. I'll guide this in voice, one question at a time.",
    voiceId: "warm-guide",
    fields: [
      {
        id: "name",
        label: "What's your name?",
        type: "text",
        required: true,
      },
      {
        id: "project",
        label: "What are you building right now?",
        type: "open",
        required: true,
      },
      {
        id: "pain",
        label: "Where does your current onboarding or intake flow break down?",
        type: "open",
        required: true,
      },
      {
        id: "timeline",
        label: "How soon do you want to launch something real?",
        type: "choice",
        required: true,
        options: ["This week", "This month", "This quarter", "Just exploring"],
      },
      {
        id: "contact",
        label: "What's the best email so we can follow up?",
        type: "email",
        required: true,
      },
    ],
  },
};

export function getFormById(id: string | undefined) {
  if (!id) return null;
  return forms[id] ?? null;
}

export function buildAgentPrompt(form: FormConfig) {
  const fieldGuide = form.fields
    .map((field, index) => {
      const options =
        field.options && field.options.length > 0
          ? ` Options: ${field.options.join(", ")}.`
          : "";

      return `${index + 1}. Ask exactly this question: "${field.label}"${options}`;
    })
    .join("\n");

  return [
    "You are the voice interface for Sayso, a warm and premium conversational form.",
    "Your job is to collect one clear answer for each field, in order, without skipping ahead.",
    "Keep your tone calm, luminous, concise, and human.",
    "Do not present yourself as a chatbot. This should feel like a guided intake.",
    "After the user gives a clear answer, call one of the configured client tools to save it.",
    "Prefer `save_form_answer`. If unavailable, use `save_answer` or `save_response`.",
    "When every required field is collected, call `complete_form`. If unavailable, try `submit_form`.",
    "Never ask more than one question in the same turn.",
    "If the answer is vague, ask a single short follow-up to clarify before saving.",
    "",
    `Form title: ${form.title}`,
    `Form description: ${form.description ?? "No description provided."}`,
    "",
    "Questions:",
    fieldGuide,
  ].join("\n");
}

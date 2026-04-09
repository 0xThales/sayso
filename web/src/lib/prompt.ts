import type { Form, FormField } from "@/types/forms";

function fieldInstruction(field: FormField, index: number): string {
  const num = index + 1;
  const required = field.required ? " (required)" : " (optional — skip if patient declines)";
  let instruction = `${num}. "${field.label}"${required}`;

  switch (field.type) {
    case "boolean":
      instruction += "\n   → Ask as a yes/no question. Save \"true\" or \"false\".";
      break;
    case "enum":
      if (field.options?.length) {
        instruction += `\n   → Offer these options naturally: ${field.options.join(", ")}. Accept exactly one.`;
      }
      break;
    case "multi_select":
      if (field.options?.length) {
        instruction += `\n   → Options: ${field.options.join(", ")}. The patient can pick several. Save as a comma-separated list.`;
      }
      break;
    case "number":
      instruction += "\n   → Expect a numeric answer.";
      if (field.validation?.min != null || field.validation?.max != null) {
        const parts: string[] = [];
        if (field.validation.min != null) parts.push(`min ${field.validation.min}`);
        if (field.validation.max != null) parts.push(`max ${field.validation.max}`);
        instruction += ` Valid range: ${parts.join(", ")}.`;
      }
      break;
    case "scale": {
      const min = field.validation?.min ?? 1;
      const max = field.validation?.max ?? 10;
      instruction += `\n   → Ask to rate from ${min} to ${max}. Save the number.`;
      break;
    }
    case "date":
      instruction += "\n   → Ask for a date. Save in YYYY-MM-DD format.";
      break;
    case "email":
      instruction += "\n   → Ask for an email address. Confirm spelling if unclear.";
      break;
    case "long_text":
      instruction += "\n   → Let them elaborate freely. Ask a brief follow-up if the answer is vague.";
      break;
    case "file":
      instruction += "\n   → Let them know they can upload a file after the conversation. Save \"pending\" for now.";
      break;
    case "text":
    default:
      break;
  }

  if (field.description) {
    instruction += `\n   Note for you: ${field.description}`;
  }

  return instruction;
}

export function buildAgentPrompt(form: Form): string {
  const sections: string[] = [];

  // Base instructions
  sections.push(
    "You are the voice interface for a conversational form powered by Sayso.",
    "Your job is to collect one clear answer for each field, in order, without skipping ahead.",
    "Never ask more than one question in the same turn.",
    "If the answer is vague, ask a single short follow-up to clarify before saving.",
    "After each clear answer, call the `save_form_answer` tool with the field id and the value.",
    "When every required field is collected, call the `complete_form` tool.",
    "If a tool name is unavailable, try `save_answer` or `submit_form` as fallbacks.",
  );

  // Personality
  if (form.personality) {
    sections.push("", `Your tone: ${form.personality}.`);
  } else {
    sections.push("", "Your tone: warm, clear, concise, and human. This should feel like a guided conversation, not an interrogation.");
  }

  // Domain knowledge (agentic: can answer questions)
  if (form.systemContext) {
    sections.push(
      "",
      "## Domain knowledge",
      "You can use the following context to answer questions the user may have. If they ask what a question means or why it matters, explain using this knowledge:",
      form.systemContext,
    );
  }

  // Form metadata
  sections.push(
    "",
    `## Form: ${form.title}`,
    form.description || "",
    "",
    "## Fields to collect (in order):",
    ...form.fields.map(fieldInstruction),
  );

  return sections.join("\n");
}

import type { FieldType, Form, FormField } from "@/types/forms";

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

// ── Form Creator prompt ─────────────────────────────────────────────────────

const FIELD_TYPE_DESCRIPTIONS: Record<FieldType, string> = {
  text: "short text (name, city, etc.)",
  long_text: "long text (open-ended, paragraphs)",
  number: "numeric value",
  boolean: "yes/no question",
  enum: "single choice from a list of options",
  multi_select: "pick several from a list of options",
  email: "email address",
  date: "date (YYYY-MM-DD)",
  scale: "numeric rating scale (e.g. 1–10)",
  file: "file upload (handled after conversation)",
};

export function buildFormCreatorPrompt(): string {
  const typeList = Object.entries(FIELD_TYPE_DESCRIPTIONS)
    .map(([type, desc]) => `- "${type}": ${desc}`)
    .join("\n");

  return `You are Sayso's form designer assistant — a warm, sharp voice that helps people create conversational forms by talking.

## Your job
Guide the user through designing a new form. You decide the structure; they describe what they need.

## Conversation flow
1. **Understand intent** — Ask what kind of form they want to create and who will fill it out. Keep it to one or two questions.
2. **Set title & description** — Once you understand the purpose, propose a title. When they confirm (or adjust), call \`set_form_title\` with the title and a one-line description.
3. **Build questions one by one**:
   - Ask what information they want to collect next.
   - Based on their answer, choose the best field type and suggest it naturally ("That sounds like a single-choice question — shall I add options?").
   - For \`enum\` or \`multi_select\`: also collect the list of options.
   - For \`scale\`: determine min and max (default 1–10).
   - Call \`add_question\` for each confirmed field.
   - After each question, ask: "What else do you want to ask?" or "Is that all?"
4. **Optional polish** — If they seem done with questions, briefly ask:
   - How should the voice agent sound when collecting answers? (personality)
   - Any custom greeting?
   - Call \`set_voice_config\` if they provide preferences.
5. **Finalize** — When the user confirms they're done, call \`finalize_form\`.

## Rules
- One topic per turn. Never ask multiple questions at once.
- Be proactive about field types — suggest the right one, don't list all options.
- If they describe something ambiguous, ask one short clarification.
- Keep turns concise — this is a voice conversation, not a document.
- Mark all questions as required by default unless the user says otherwise.
- Generate a short, stable \`id\` for each field (e.g. "full_name", "satisfaction_rating") — use snake_case based on the label.
- If the user wants to change or remove a previously added question, use \`update_question\` or \`remove_question\`.

## Available field types
${typeList}

## Tools
- \`set_form_title\` — params: { title: string, description?: string }
- \`add_question\` — params: { id: string, label: string, type: string, required: boolean, options?: string[], description?: string, min?: number, max?: number }
- \`update_question\` — params: { index: number, label?: string, type?: string, required?: boolean, options?: string[], description?: string }
- \`remove_question\` — params: { index: number }
- \`set_voice_config\` — params: { greeting?: string, personality?: string }
- \`finalize_form\` — no params. Call when the user is done.

## Tone
Warm, clear, quietly confident. You're a collaborator, not a form wizard. Keep it human.`;
}

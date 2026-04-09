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

// ── Form Creator prompt ─────────────────────────────────────────────────────

export function buildFormCreatorPrompt(): string {
  return `You are a friendly assistant that helps people create voice forms through conversation. Think of yourself as a creative collaborator — like a colleague helping someone plan a questionnaire over coffee.

## How you work
The user describes what they need, and you build the form for them behind the scenes. They should never hear about field types, IDs, technical parameters, or tool names. To them, you're just having a natural conversation about what they want to ask people.

## Flow
1. Ask what the form is for and who it's aimed at. One or two natural questions, tops.
2. Once you get it, propose a name and set it up (call set_form_title).
3. Start adding questions. Here's the key part:
   - If they describe several questions at once, add them ALL in one go. Don't force them to repeat or go one by one.
   - If they're vague, help them shape the questions — but don't over-ask.
   - You decide the best format for each question (short text, yes/no, multiple choice, rating, etc.) based on what makes sense. Don't explain your choice unless they ask.
   - For questions with options (like "what level?" or "which service?"), pick up the options from context or ask briefly.
4. After adding questions, give a quick natural summary: "Great, I've added three questions — name, email, and how they heard about you." No technical details. Just what a human would say.
5. Ask if they want to add more, change anything, or if they're happy with it.
6. When they're done, ask briefly about the vibe — should the voice agent be formal, casual, friendly? Any specific greeting? Then set it up (set_voice_config) and finalize (finalize_form).

## What to NEVER do
- Never mention field types, IDs, indexes, or any technical term.
- Never say things like "I've added a text field" or "question of type enum". Say "I've added a question about their name" or "I've added a multiple choice question about their preferred day".
- Never list your tools or parameters.
- Never ask the user to confirm every single question individually if they gave you a batch.
- Never act like a developer or a form builder. Act like a helpful person.

## What to ALWAYS do
- Be concise. This is voice — short sentences, natural rhythm.
- Be proactive. If someone says "I need a feedback form for my gym", you can propose a reasonable set of questions and add them, then ask if they want to tweak anything.
- Use their language and context. If they say "clients", you say "clients". If they say "patients", you say "patients".
- Match their energy. Casual user? Be casual. Professional user? Be professional.

## Field type guide (for your internal use — never share this with the user)
- Short answer → type "text"
- Paragraph/open-ended → type "long_text"
- Number → type "number"
- Yes/No → type "boolean"
- Pick one from a list → type "enum" (set options)
- Pick several from a list → type "multi_select" (set options)
- Email → type "email"
- Date → type "date"
- Rating (1-10, 1-5, etc.) → type "scale" (set min/max)
- File upload → type "file"

Generate a snake_case id from the label automatically. Mark questions as required unless the user says otherwise.`;
}

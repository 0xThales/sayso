import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const API_BASE = "https://api.elevenlabs.io/v1";

function loadEnvFile(path) {
  const fullPath = resolve(path);
  const raw = readFileSync(fullPath, "utf8");
  const env = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

const env = {
  ...loadEnvFile("./api/.env"),
  ...process.env,
};

const apiKey = env.ELEVENLABS_API_KEY;
const agentIds = Array.from(
  new Set(
    [
      env.ELEVENLABS_AGENT_ID,
      env.ELEVENLABS_CREATOR_AGENT_ID,
      env.ELEVENLABS_RESPONSE_AGENT_ID,
    ].filter(Boolean),
  ),
);

if (!apiKey) {
  throw new Error("Missing ELEVENLABS_API_KEY");
}

if (agentIds.length === 0) {
  throw new Error(
    "Missing agent configuration. Set ELEVENLABS_AGENT_ID and/or ELEVENLABS_CREATOR_AGENT_ID / ELEVENLABS_RESPONSE_AGENT_ID",
  );
}

function clientTool({
  name,
  description,
  parameters,
  responseTimeoutSecs = 20,
}) {
  return {
    type: "client",
    name,
    description,
    response_timeout_secs: responseTimeoutSecs,
    disable_interruptions: false,
    force_pre_tool_speech: false,
    assignments: [],
    tool_call_sound: null,
    tool_call_sound_behavior: "auto",
    tool_error_handling_mode: "auto",
    parameters,
    expects_response: true,
    dynamic_variables: {
      dynamic_variable_placeholders: {},
    },
    execution_mode: "immediate",
  };
}

const answerValueProperties = {
  field_id: {
    type: "string",
    description: "Exact field ID when known.",
  },
  fieldId: {
    type: "string",
    description: "CamelCase alias for field_id.",
  },
  question_id: {
    type: "string",
    description: "Legacy alias for the field ID.",
  },
  questionId: {
    type: "string",
    description: "CamelCase legacy alias for the field ID.",
  },
  label: {
    type: "string",
    description: "Human-readable field label when the field ID is unknown.",
  },
  value: {
    type: "string",
    description: "Confirmed answer value to save.",
  },
  answer: {
    type: "string",
    description: "Fallback alias for value.",
  },
};

const tools = [
  clientTool({
    name: "save_form_answer",
    description:
      "Save one confirmed respondent answer during a live form-filling conversation. Call this immediately after a clear answer.",
    parameters: {
      type: "object",
      required: ["value"],
      description: "Single saved answer payload.",
      properties: answerValueProperties,
    },
    responseTimeoutSecs: 30,
  }),
  clientTool({
    name: "save_answer",
    description:
      "Alias for save_form_answer. Save one confirmed respondent answer during a live form-filling conversation.",
    parameters: {
      type: "object",
      required: ["value"],
      description: "Single saved answer payload.",
      properties: answerValueProperties,
    },
    responseTimeoutSecs: 30,
  }),
  clientTool({
    name: "save_response",
    description:
      "Alias for save_form_answer. Save one confirmed respondent answer during a live form-filling conversation.",
    parameters: {
      type: "object",
      required: ["value"],
      description: "Single saved answer payload.",
      properties: answerValueProperties,
    },
    responseTimeoutSecs: 30,
  }),
  clientTool({
    name: "complete_form",
    description:
      "Finalize the current form workflow. In response mode, submit the collected answers. In creation mode, save the drafted form.",
    parameters: {
      type: "object",
      required: [],
      description: "No parameters are required.",
      properties: {},
    },
    responseTimeoutSecs: 30,
  }),
  clientTool({
    name: "submit_form",
    description:
      "Alias for complete_form. Finalize the current form workflow and wait for the result before continuing.",
    parameters: {
      type: "object",
      required: [],
      description: "No parameters are required.",
      properties: {},
    },
    responseTimeoutSecs: 30,
  }),
  clientTool({
    name: "set_form_title",
    description:
      "Set the working title and optional description for a form while it is being created.",
    parameters: {
      type: "object",
      required: ["title"],
      description: "Form title payload.",
      properties: {
        title: {
          type: "string",
          description: "Natural-language title for the form.",
        },
        description: {
          type: "string",
          description: "Optional one-line description for the form.",
        },
      },
    },
  }),
  clientTool({
    name: "add_question",
    description:
      "Add one new question to the form draft during form creation.",
    parameters: {
      type: "object",
      required: ["label"],
      description: "Question definition to add.",
      properties: {
        id: {
          type: "string",
          description: "Optional stable question ID in snake_case.",
        },
        label: {
          type: "string",
          description: "Question label shown to respondents.",
        },
        type: {
          type: "string",
          description:
            "Question type. Use one of: text, long_text, number, boolean, enum, multi_select, email, date, scale, file.",
        },
        required: {
          type: "boolean",
          description: "Whether the question is required.",
        },
        options: {
          type: "array",
          description: "Options for enum or multi_select questions.",
          items: {
            type: "string",
            description: "One option label.",
          },
        },
        description: {
          type: "string",
          description: "Optional helper text for the question.",
        },
        min: {
          type: "number",
          description: "Minimum value for scale questions.",
        },
        max: {
          type: "number",
          description: "Maximum value for scale questions.",
        },
      },
    },
  }),
  clientTool({
    name: "update_question",
    description:
      "Update one existing question in the form draft by its zero-based index.",
    parameters: {
      type: "object",
      required: ["index"],
      description: "Question update payload.",
      properties: {
        index: {
          type: "number",
          description: "Zero-based question index to update.",
        },
        label: {
          type: "string",
          description: "Updated question label.",
        },
        type: {
          type: "string",
          description:
            "Updated question type. Use one of: text, long_text, number, boolean, enum, multi_select, email, date, scale, file.",
        },
        required: {
          type: "boolean",
          description: "Updated required flag.",
        },
        options: {
          type: "array",
          description: "Updated options for enum or multi_select questions.",
          items: {
            type: "string",
            description: "One option label.",
          },
        },
        description: {
          type: "string",
          description: "Updated helper text.",
        },
      },
    },
  }),
  clientTool({
    name: "remove_question",
    description:
      "Remove one existing question from the form draft by its zero-based index.",
    parameters: {
      type: "object",
      required: ["index"],
      description: "Question removal payload.",
      properties: {
        index: {
          type: "number",
          description: "Zero-based question index to remove.",
        },
      },
    },
  }),
  clientTool({
    name: "set_voice_config",
    description:
      "Set the greeting and personality/tone for the voice agent that will run the form.",
    parameters: {
      type: "object",
      required: [],
      description: "Voice configuration for the form.",
      properties: {
        greeting: {
          type: "string",
          description: "Opening greeting the voice agent should use.",
        },
        personality: {
          type: "string",
          description: "Tone or personality for the voice agent.",
        },
      },
    },
  }),
  clientTool({
    name: "finalize_form",
    description:
      "Create and persist the drafted form once all questions and voice settings are ready.",
    parameters: {
      type: "object",
      required: [],
      description: "No parameters are required.",
      properties: {},
    },
    responseTimeoutSecs: 30,
  }),
];

async function elevenlabsFetch(path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${init.method ?? "GET"} ${path} failed: ${res.status} ${text}`);
  }

  return res.json();
}

const existingToolsResponse = await elevenlabsFetch("/convai/tools?page_size=100");
const existingTools = existingToolsResponse.tools ?? [];
const toolIdsByName = new Map(existingTools.map((tool) => [tool.tool_config.name, tool.id]));

for (const toolConfig of tools) {
  if (toolIdsByName.has(toolConfig.name)) {
    console.log(`Using existing tool: ${toolConfig.name} -> ${toolIdsByName.get(toolConfig.name)}`);
    continue;
  }

  const created = await elevenlabsFetch("/convai/tools", {
    method: "POST",
    body: JSON.stringify({ tool_config: toolConfig }),
  });

  toolIdsByName.set(created.tool_config.name, created.id);
  console.log(`Created tool: ${created.tool_config.name} -> ${created.id}`);
}

const desiredToolIds = tools.map((tool) => {
  const id = toolIdsByName.get(tool.name);
  if (!id) {
    throw new Error(`Missing tool ID after sync for ${tool.name}`);
  }
  return id;
});

for (const agentId of agentIds) {
  const agent = await elevenlabsFetch(`/convai/agents/${agentId}`);
  const existingToolIds = agent.conversation_config?.agent?.prompt?.tool_ids ?? [];
  const mergedToolIds = Array.from(new Set([...existingToolIds, ...desiredToolIds]));

  await elevenlabsFetch(`/convai/agents/${agentId}`, {
    method: "PATCH",
    body: JSON.stringify({
      conversation_config: {
        agent: {
          prompt: {
            tool_ids: mergedToolIds,
          },
        },
      },
    }),
  });

  const updatedAgent = await elevenlabsFetch(`/convai/agents/${agentId}`);
  const updatedToolIds = updatedAgent.conversation_config?.agent?.prompt?.tool_ids ?? [];

  console.log("");
  console.log(`Agent synced: ${agentId}`);
  console.log(`Attached tool IDs (${updatedToolIds.length}):`);
  for (const id of updatedToolIds) {
    console.log(`- ${id}`);
  }
}

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const AGENT_CONFIG_PATH = resolve("agent_configs/Sayso-Intake.json");
const API_ENV_PATH = resolve("api/.env");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};

  const raw = readFileSync(path, "utf8");
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

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function summarizeLocalConfig(localConfig) {
  const prompt = localConfig?.conversation_config?.agent?.prompt ?? {};
  return {
    agentId: localConfig?.agent_id ?? null,
    firstMessage: localConfig?.conversation_config?.agent?.first_message ?? null,
    promptPreview:
      typeof prompt.prompt === "string" ? prompt.prompt.slice(0, 120) : null,
    toolIdsCount: Array.isArray(prompt.tool_ids) ? prompt.tool_ids.length : 0,
    toolsCount: Array.isArray(prompt.tools) ? prompt.tools.length : 0,
    hasOnlyEndCallTool:
      Array.isArray(prompt.tools) &&
      prompt.tools.length === 1 &&
      prompt.tools[0]?.name === "end_call",
  };
}

function summarizeRemoteConfig(remoteConfig) {
  const prompt = remoteConfig?.conversation_config?.agent?.prompt ?? {};
  return {
    agentId: remoteConfig?.agent_id ?? null,
    name: remoteConfig?.name ?? null,
    creatorEmail: remoteConfig?.access_info?.creator_email ?? null,
    firstMessage: remoteConfig?.conversation_config?.agent?.first_message ?? null,
    promptPreview:
      typeof prompt.prompt === "string" ? prompt.prompt.slice(0, 120) : null,
    toolIdsCount: Array.isArray(prompt.tool_ids) ? prompt.tool_ids.length : 0,
    toolsCount: Array.isArray(prompt.tools) ? prompt.tools.length : 0,
    updatedAtUnixSecs: remoteConfig?.metadata?.updated_at_unix_secs ?? null,
  };
}

function printSection(title, data) {
  console.log(`\n## ${title}`);
  console.log(JSON.stringify(data, null, 2));
}

async function fetchAgent(apiKey, agentId) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
    { headers: { "xi-api-key": apiKey } },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch remote agent (${response.status})`);
  }

  return response.json();
}

async function main() {
  const env = {
    ...loadEnvFile(API_ENV_PATH),
    ...process.env,
  };

  const apiKey = env.ELEVENLABS_API_KEY;
  const agentId = env.ELEVENLABS_AGENT_ID;

  if (!apiKey) {
    throw new Error("Missing ELEVENLABS_API_KEY in api/.env or process.env");
  }

  if (!agentId) {
    throw new Error("Missing ELEVENLABS_AGENT_ID in api/.env or process.env");
  }

  const localConfig = loadJson(AGENT_CONFIG_PATH);
  const remoteConfig = await fetchAgent(apiKey, agentId);

  const localSummary = summarizeLocalConfig(localConfig);
  const remoteSummary = summarizeRemoteConfig(remoteConfig);

  printSection("Env Source", {
    apiEnvPath: API_ENV_PATH,
    envAgentId: agentId,
    creatorAgentId: env.ELEVENLABS_CREATOR_AGENT_ID ?? null,
    responseAgentId: env.ELEVENLABS_RESPONSE_AGENT_ID ?? null,
    apiKeyPresent: Boolean(apiKey),
  });

  printSection("Local JSON", localSummary);
  printSection("Remote Agent", remoteSummary);

  printSection("Diff Summary", {
    agentIdMatches: localSummary.agentId === remoteSummary.agentId,
    firstMessageMatches:
      localSummary.firstMessage === remoteSummary.firstMessage,
    promptPreviewMatches:
      localSummary.promptPreview === remoteSummary.promptPreview,
    toolIdsCountMatches:
      localSummary.toolIdsCount === remoteSummary.toolIdsCount,
    toolsCountMatches:
      localSummary.toolsCount === remoteSummary.toolsCount,
    likelyLocalJsonOutdated:
      localSummary.toolIdsCount !== remoteSummary.toolIdsCount ||
      localSummary.toolsCount !== remoteSummary.toolsCount,
  });

  console.log("\n## Runtime Notes");
  console.log(
    [
      "- Creator sessions override the agent prompt and first message at runtime from web/src/lib/prompt.ts and web/src/pages/VoiceFormCreator.tsx.",
      "- Tool registration does not come from the frontend override. It comes from the remote ElevenLabs agent.",
      "- If remote and local JSON differ, the remote agent is the source of truth for tools.",
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

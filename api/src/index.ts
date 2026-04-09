import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import "dotenv/config";

const app = new Hono().basePath("/api");

app.use("*", cors());

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/elevenlabs/token", async (c) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!apiKey || !agentId) {
    return c.json({ error: "Missing ElevenLabs config" }, 500);
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
    { headers: { "xi-api-key": apiKey } },
  );

  if (!res.ok) {
    return c.json({ error: "Failed to get signed URL" }, 502);
  }

  const data = (await res.json()) as { signed_url: string };
  return c.json({ signedUrl: data.signed_url });
});

serve({ fetch: app.fetch, port: 3001 }, (info) => {
  console.log(`API running on http://localhost:${info.port}`);
});

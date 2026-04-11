import Langfuse from "langfuse";

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: Langfuse | null = null;

function getLangfuse(): Langfuse | null {
  if (instance) return instance;

  const publicKey = import.meta.env.VITE_LANGFUSE_PUBLIC_KEY as
    | string
    | undefined;
  if (!publicKey) return null;

  instance = new Langfuse({
    publicKey,
    baseUrl:
      (import.meta.env.VITE_LANGFUSE_BASE_URL as string | undefined) ??
      "https://cloud.langfuse.com",
  });

  return instance;
}

// ── Types ───────────────────────────────────────────────────────────────────

export type LangfuseTrace = ReturnType<Langfuse["trace"]>;
export type LangfuseSpan = ReturnType<LangfuseTrace["span"]>;

// ── Session trace ───────────────────────────────────────────────────────────

export function traceSession(options: {
  sessionType: "form_response" | "form_creation";
  conversationId: string;
  formSlug?: string;
  formTitle?: string;
  formId?: string;
}): LangfuseTrace | null {
  const lf = getLangfuse();
  if (!lf) return null;

  return lf.trace({
    name: `voice:${options.sessionType}`,
    sessionId: options.conversationId,
    tags: [options.sessionType],
    metadata: {
      formSlug: options.formSlug,
      formTitle: options.formTitle,
      formId: options.formId,
    },
  });
}

// ── Flush (call on disconnect / unmount) ────────────────────────────────────

export function flushTracing() {
  instance?.flushAsync().catch(() => {});
}

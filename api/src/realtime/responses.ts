import type { FormResponse } from "../db/schema.js";

type ResponseEvent = {
  type: "response.created" | "response.updated";
  response: FormResponse;
};

type Subscriber = (event: ResponseEvent) => Promise<void> | void;

const channels = new Map<string, Set<Subscriber>>();

export function subscribeToFormResponses(
  formId: string,
  subscriber: Subscriber,
): () => void {
  const subscribers = channels.get(formId) ?? new Set<Subscriber>();
  subscribers.add(subscriber);
  channels.set(formId, subscribers);

  return () => {
    const current = channels.get(formId);
    if (!current) return;
    current.delete(subscriber);
    if (current.size === 0) {
      channels.delete(formId);
    }
  };
}

export async function publishFormResponseCreated(
  formId: string,
  response: FormResponse,
): Promise<void> {
  const subscribers = channels.get(formId);
  if (!subscribers?.size) return;

  await Promise.allSettled(
    Array.from(subscribers).map((subscriber) =>
      Promise.resolve(subscriber({ type: "response.created", response })),
    ),
  );
}

export async function publishFormResponseUpdated(
  formId: string,
  response: FormResponse,
): Promise<void> {
  const subscribers = channels.get(formId);
  if (!subscribers?.size) return;

  await Promise.allSettled(
    Array.from(subscribers).map((subscriber) =>
      Promise.resolve(subscriber({ type: "response.updated", response })),
    ),
  );
}

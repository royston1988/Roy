// Thin REST client + the streaming chat helper for Roy's AI assistant.

async function req<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(p: string) => req<T>(p),
  post: <T>(p: string, b?: unknown) => req<T>(p, "POST", b),
  put: <T>(p: string, b?: unknown) => req<T>(p, "PUT", b),
  patch: <T>(p: string, b?: unknown) => req<T>(p, "PATCH", b),
  del: <T>(p: string) => req<T>(p, "DELETE"),
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

type StreamHandlers = {
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
  signal?: AbortSignal;
};

export async function streamChat(
  messages: ChatMessage[],
  context: string | undefined,
  { onDelta, onDone, onError, signal }: StreamHandlers,
) {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, context }),
      signal,
    });
  } catch (err) {
    onError(err instanceof Error ? err.message : "network error");
    return;
  }
  if (!res.ok || !res.body) {
    onError(`backend responded ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (err) {
      onError(err instanceof Error ? err.message : "stream read failed");
      return;
    }
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const parsed = parseFrame(frame);
      if (!parsed) continue;
      if (parsed.event === "delta") onDelta(parsed.data.text ?? "");
      else if (parsed.event === "done") {
        onDone();
        return;
      } else if (parsed.event === "error") {
        onError(parsed.data.message ?? "unknown error");
        return;
      }
    }
  }
  onDone();
}

function parseFrame(
  frame: string,
): { event: string; data: Record<string, string> } | null {
  let event = "message";
  let dataLine = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
  }
  if (!dataLine) return { event, data: {} };
  try {
    return { event, data: JSON.parse(dataLine) };
  } catch {
    return null;
  }
}

export type Mode = "auto" | "quick" | "standard" | "deep";

export type ModelInfo = {
  tier: Exclude<Mode, "auto">;
  label: string;
  auto: boolean;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  model?: ModelInfo;
};

type StreamHandlers = {
  onModel: (info: ModelInfo) => void;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
  signal?: AbortSignal;
};

export async function streamChat(
  messages: ChatMessage[],
  mode: Mode,
  { onModel, onDelta, onDone, onError, signal }: StreamHandlers,
) {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages.map(({ role, content }) => ({ role, content })),
        mode,
      }),
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
      if (parsed.event === "model") {
        onModel(parsed.data as ModelInfo);
      } else if (parsed.event === "delta") {
        onDelta(String(parsed.data.text ?? ""));
      } else if (parsed.event === "done") {
        onDone();
        return;
      } else if (parsed.event === "error") {
        onError(String(parsed.data.message ?? "unknown error"));
        return;
      }
    }
  }
  onDone();
}

function parseFrame(
  frame: string,
): { event: string; data: Record<string, unknown> } | null {
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

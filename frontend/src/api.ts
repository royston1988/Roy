export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type Task = {
  id: string;
  title: string;
  notes: string;
  status: "todo" | "doing" | "done";
  priority: number;
  project: string;
  due_date: string | null;
  estimate_min: number | null;
  is_top3: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type Block = {
  id: string;
  task_id: string | null;
  title: string;
  date: string;
  start_min: number;
  end_min: number;
  created_at: string;
};

export type Stats = {
  since: string;
  completed: number;
  created: number;
  open_by_priority: { priority: number; n: number }[];
  focus_seconds: number;
  focus_by_project: { project: string; seconds: number }[];
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`request failed (${res.status})`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------- Tasks ----------

export const getTasks = (status?: string) =>
  fetch(`/api/tasks${status ? `?status=${status}` : ""}`).then(json<Task[]>);

export const addTask = (t: Partial<Task>) =>
  fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(t),
  }).then(json<Task>);

export const patchTask = (id: string, patch: Partial<Task>) =>
  fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).then(json<Task>);

export const removeTask = (id: string) =>
  fetch(`/api/tasks/${id}`, { method: "DELETE" }).then(json<void>);

// ---------- Blocks ----------

export const getBlocks = (date: string) =>
  fetch(`/api/blocks?date=${date}`).then(json<Block[]>);

export const addBlock = (b: Partial<Block>) =>
  fetch("/api/blocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b),
  }).then(json<Block>);

export const removeBlock = (id: string) =>
  fetch(`/api/blocks/${id}`, { method: "DELETE" }).then(json<void>);

// ---------- Sessions ----------

export const logSession = (s: {
  task_id?: string | null;
  kind?: string;
  started_at?: string;
  ended_at?: string;
  seconds: number;
}) =>
  fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(s),
  }).then(json<unknown>);

// ---------- Stats ----------

export const getStats = (days = 7) =>
  fetch(`/api/stats?days=${days}`).then(json<Stats>);

// ---------- Streaming (chat + plan) ----------

type StreamHandlers = {
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
  signal?: AbortSignal;
};

async function streamSSE(
  url: string,
  body: unknown,
  { onDelta, onDone, onError, signal }: StreamHandlers,
) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
      else if (parsed.event === "done") return onDone();
      else if (parsed.event === "error")
        return onError(parsed.data.message ?? "unknown error");
    }
  }
  onDone();
}

export const streamChat = (messages: ChatMessage[], h: StreamHandlers) =>
  streamSSE("/api/chat", { messages }, h);

export const streamPlan = (
  input: { date: string; request?: string },
  h: StreamHandlers,
) => streamSSE("/api/plan", input, h);

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

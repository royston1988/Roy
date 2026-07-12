import "dotenv/config";
import express from "express";
import cors from "cors";
import { streamChat, streamPlan, type ChatMessage } from "./claude.js";
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  listBlocks,
  createBlock,
  updateBlock,
  deleteBlock,
  createSession,
  statsSince,
} from "./store.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6" });
});

// ---------- Tasks ----------

app.get("/api/tasks", (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  res.json(listTasks(status ? { status } : undefined));
});

app.post("/api/tasks", (req, res) => {
  const title = String(req.body?.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "title is required" });
  res.status(201).json(createTask(req.body));
});

app.patch("/api/tasks/:id", (req, res) => {
  const updated = updateTask(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "task not found" });
  res.json(updated);
});

app.delete("/api/tasks/:id", (req, res) => {
  if (!deleteTask(req.params.id)) return res.status(404).json({ error: "task not found" });
  res.status(204).end();
});

// ---------- Blocks (time-blocking) ----------

app.get("/api/blocks", (req, res) => {
  const date = String(req.query.date ?? "");
  if (!date) return res.status(400).json({ error: "date query param is required" });
  res.json(listBlocks(date));
});

app.post("/api/blocks", (req, res) => {
  if (!req.body?.date) return res.status(400).json({ error: "date is required" });
  res.status(201).json(createBlock(req.body));
});

app.patch("/api/blocks/:id", (req, res) => {
  const updated = updateBlock(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "block not found" });
  res.json(updated);
});

app.delete("/api/blocks/:id", (req, res) => {
  if (!deleteBlock(req.params.id)) return res.status(404).json({ error: "block not found" });
  res.status(204).end();
});

// ---------- Sessions (time tracking / pomodoro) ----------

app.post("/api/sessions", (req, res) => {
  res.status(201).json(createSession(req.body));
});

// ---------- Stats / weekly review ----------

app.get("/api/stats", (req, res) => {
  const days = Number(req.query.days ?? 7);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  res.json(statsSince(since));
});

// ---------- Streaming helpers ----------

function streamSSE(
  res: express.Response,
  gen: AsyncIterable<string>,
): Promise<void> {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  return (async () => {
    try {
      for await (const delta of gen) send("delta", { text: delta });
      send("done", {});
    } catch (err) {
      send("error", { message: err instanceof Error ? err.message : String(err) });
    } finally {
      res.end();
    }
  })();
}

// ---------- Chat ----------

app.post("/api/chat", async (req, res) => {
  const messages = req.body?.messages as ChatMessage[] | undefined;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages must be a non-empty array" });
  }
  await streamSSE(res, streamChat(messages));
});

// ---------- Plan my day ----------

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

app.post("/api/plan", async (req, res) => {
  const date = String(req.body?.date ?? new Date().toISOString().slice(0, 10));
  const request =
    String(req.body?.request ?? "").trim() ||
    "Plan my day: give me my top priorities and a realistic time-blocked schedule.";

  const open = listTasks().filter((t) => t.status !== "done");
  const blocks = listBlocks(date);

  const priLabel = (p: number) => (p === 1 ? "P1" : p === 2 ? "P2" : "P3");
  const taskLines =
    open.length === 0
      ? "  (no open tasks)"
      : open
          .map((t) => {
            const bits = [priLabel(t.priority)];
            if (t.is_top3) bits.push("TOP3");
            if (t.due_date) bits.push(`due ${t.due_date}`);
            if (t.estimate_min) bits.push(`~${t.estimate_min}m`);
            if (t.project) bits.push(`#${t.project}`);
            return `  - ${t.title} [${bits.join(", ")}]`;
          })
          .join("\n");

  const blockLines =
    blocks.length === 0
      ? "  (nothing scheduled yet)"
      : blocks
          .map((b) => `  - ${fmtMin(b.start_min)}–${fmtMin(b.end_min)} ${b.title}`)
          .join("\n");

  const context = `Date: ${date}\n\nOpen tasks:\n${taskLines}\n\nAlready scheduled today:\n${blockLines}`;
  await streamSSE(res, streamPlan(context, request));
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`[roy] backend listening on http://localhost:${port}`);
});

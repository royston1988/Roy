import "dotenv/config";
import express from "express";
import cors from "cors";
import { streamChat, type ChatMessage } from "./claude.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6" });
});

app.post("/api/chat", async (req, res) => {
  const messages = req.body?.messages as ChatMessage[] | undefined;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages must be a non-empty array" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    for await (const delta of streamChat(messages)) {
      send("delta", { text: delta });
    }
    send("done", {});
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send("error", { message });
  } finally {
    res.end();
  }
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`[jarvis] backend listening on http://localhost:${port}`);
});

import "dotenv/config";
import express from "express";
import cors from "cors";
import { client, streamChat, type ChatMessage } from "./claude.js";
import { chooseModel, MODES, TIERS, type Mode } from "./router.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, models: TIERS });
});

app.post("/api/chat", async (req, res) => {
  const messages = req.body?.messages as ChatMessage[] | undefined;
  const mode = (req.body?.mode ?? "auto") as Mode;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages must be a non-empty array" });
    return;
  }
  if (!MODES.includes(mode)) {
    res.status(400).json({ error: `mode must be one of ${MODES.join(", ")}` });
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
    const choice = await chooseModel(client, messages, mode);
    console.log(`[jarvis] ${choice.auto ? "auto" : "manual"} → ${choice.tier} (${choice.model})`);
    send("model", { tier: choice.tier, label: choice.label, auto: choice.auto });

    for await (const delta of streamChat(messages, choice)) {
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

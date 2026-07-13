import "dotenv/config";
import express from "express";
import cors from "cors";
import { getDb, id, mutate } from "./store.js";
import { enrich } from "./priority.js";
import { timeReport } from "./analytics.js";
import {
  aiEnabled,
  classifyInbox,
  delegationReminderText,
  planDay,
  reviewDay,
  streamChat,
  type ChatMessage,
} from "./ai.js";
import { DATE_RE, localDate, normalizeHM } from "./dates.js";
import type {
  BlockType,
  CalendarBlock,
  Decision,
  Delegation,
  DelegationStatus,
  InboxItem,
  Meeting,
  Task,
} from "./types.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const nowIso = () => new Date().toISOString();
const today = () => localDate();

const IMPACTS = ["high", "medium", "low"];
const URGENCIES = ["today", "week", "later"];
const RESPONSIBILITIES = ["only-roy", "roy-decides", "team", "should-not"];
const TIMES = [15, 30, 60, 120];
const BLOCK_TYPES: BlockType[] = [
  "thinking",
  "decision",
  "meeting",
  "review",
  "people",
  "personal",
];
const DELEGATION_STATUSES: DelegationStatus[] = [
  "in-progress",
  "waiting",
  "delayed",
  "done",
];

/** Copy only whitelisted, defined keys from a request body. */
function pick<T extends object>(body: Record<string, unknown>, keys: string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (body[k] !== undefined) out[k] = body[k];
  return out as Partial<T>;
}

/** Returns an error string if any provided field fails its validator. */
function invalid(
  body: Record<string, unknown>,
  rules: Record<string, (v: unknown) => boolean>,
): string | null {
  for (const [key, ok] of Object.entries(rules)) {
    if (body[key] !== undefined && !ok(body[key])) return `invalid ${key}`;
  }
  return null;
}

const isOneOf = (values: readonly unknown[]) => (v: unknown) => values.includes(v);
const isDateStr = (v: unknown) => typeof v === "string" && (v === "" || DATE_RE.test(v));
const isStr = (v: unknown) => typeof v === "string";

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ai: aiEnabled, model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6" });
});

/* ----------------------------- Tasks ----------------------------- */

app.get("/api/tasks", (_req, res) => {
  const tasks = getDb().tasks.map(enrich).sort((a, b) => b.score - a.score);
  res.json(tasks);
});

const TASK_RULES = {
  impact: isOneOf(IMPACTS),
  urgency: isOneOf(URGENCIES),
  responsibility: isOneOf(RESPONSIBILITIES),
  timeNeeded: isOneOf(TIMES),
  status: isOneOf(["todo", "done"]),
};

app.post("/api/tasks", (req, res) => {
  const b = req.body ?? {};
  if (!b.title?.trim()) return res.status(400).json({ error: "title required" });
  const err = invalid(b, TASK_RULES);
  if (err) return res.status(400).json({ error: err });
  const task: Task = {
    id: id("task"),
    title: String(b.title).trim(),
    notes: b.notes,
    impact: b.impact ?? "medium",
    urgency: b.urgency ?? "week",
    responsibility: b.responsibility ?? "roy-decides",
    timeNeeded: b.timeNeeded ?? 30,
    status: "todo",
    isTopPriority: Boolean(b.isTopPriority),
    createdAt: nowIso(),
  };
  mutate((db) => db.tasks.push(task));
  res.status(201).json(enrich(task));
});

app.patch("/api/tasks/:id", (req, res) => {
  const b = req.body ?? {};
  const err = invalid(b, TASK_RULES);
  if (err) return res.status(400).json({ error: err });
  const task = mutate((db) => {
    const t = db.tasks.find((t) => t.id === req.params.id);
    if (!t) return null;
    Object.assign(t, {
      title: b.title ?? t.title,
      notes: b.notes ?? t.notes,
      impact: b.impact ?? t.impact,
      urgency: b.urgency ?? t.urgency,
      responsibility: b.responsibility ?? t.responsibility,
      timeNeeded: b.timeNeeded ?? t.timeNeeded,
      isTopPriority:
        b.isTopPriority === undefined ? t.isTopPriority : Boolean(b.isTopPriority),
    });
    if (b.status && b.status !== t.status) {
      t.status = b.status;
      t.completedAt = b.status === "done" ? nowIso() : undefined;
    }
    return t;
  });
  if (!task) return res.status(404).json({ error: "not found" });
  res.json(enrich(task));
});

app.delete("/api/tasks/:id", (req, res) => {
  mutate((db) => {
    db.tasks = db.tasks.filter((t) => t.id !== req.params.id);
  });
  res.json({ ok: true });
});

/* ----------------------------- Inbox ----------------------------- */

app.get("/api/inbox", (_req, res) => {
  res.json(getDb().inbox.filter((i) => !i.processed));
});

app.post("/api/inbox", (req, res) => {
  const text = String(req.body?.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "text required" });
  const item: InboxItem = { id: id("inb"), text, createdAt: nowIso() };
  mutate((db) => db.inbox.push(item));
  res.status(201).json(item);
});

app.post("/api/inbox/:id/classify", async (req, res) => {
  const item = getDb().inbox.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: "not found" });
  try {
    const { classification, reason } = await classifyInbox(item.text);
    mutate(() => {
      item.classification = classification;
    });
    res.json({ ...item, reason });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.patch("/api/inbox/:id", (req, res) => {
  const item = mutate((db) => {
    const it = db.inbox.find((i) => i.id === req.params.id);
    if (!it) return null;
    if (req.body?.classification) it.classification = req.body.classification;
    if (req.body?.processed !== undefined) it.processed = Boolean(req.body.processed);
    return it;
  });
  if (!item) return res.status(404).json({ error: "not found" });
  res.json(item);
});

app.delete("/api/inbox/:id", (req, res) => {
  mutate((db) => {
    db.inbox = db.inbox.filter((i) => i.id !== req.params.id);
  });
  res.json({ ok: true });
});

/* --------------------------- Calendar ---------------------------- */

app.get("/api/blocks", (req, res) => {
  const date = req.query.date as string | undefined;
  const blocks = getDb().blocks.filter((b) => (date ? b.date === date : true));
  blocks.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  res.json(blocks);
});

app.post("/api/blocks", (req, res) => {
  const b = req.body ?? {};
  if (!b.title?.trim()) return res.status(400).json({ error: "title required" });
  const start = normalizeHM(b.start);
  const end = normalizeHM(b.end);
  if (!start || !end) return res.status(400).json({ error: "start/end must be HH:MM" });
  if (b.date !== undefined && !isDateStr(b.date)) {
    return res.status(400).json({ error: "invalid date" });
  }
  if (b.type !== undefined && !BLOCK_TYPES.includes(b.type)) {
    return res.status(400).json({ error: "invalid type" });
  }
  const block: CalendarBlock = {
    id: id("blk"),
    date: b.date || today(),
    start,
    end,
    title: String(b.title).trim(),
    type: b.type ?? "meeting",
    taskId: b.taskId,
  };
  mutate((db) => db.blocks.push(block));
  res.status(201).json(block);
});

app.patch("/api/blocks/:id", (req, res) => {
  const b = req.body ?? {};
  const patch = pick<CalendarBlock>(b, ["date", "start", "end", "title", "type", "taskId"]);
  if (patch.start !== undefined || patch.end !== undefined) {
    const start = patch.start === undefined ? null : normalizeHM(patch.start);
    const end = patch.end === undefined ? null : normalizeHM(patch.end);
    if (patch.start !== undefined && !start) return res.status(400).json({ error: "start must be HH:MM" });
    if (patch.end !== undefined && !end) return res.status(400).json({ error: "end must be HH:MM" });
    if (start) patch.start = start;
    if (end) patch.end = end;
  }
  const err = invalid(patch, { date: isDateStr, type: isOneOf(BLOCK_TYPES), title: isStr });
  if (err) return res.status(400).json({ error: err });
  const block = mutate((db) => {
    const bl = db.blocks.find((x) => x.id === req.params.id);
    if (!bl) return null;
    Object.assign(bl, patch);
    return bl;
  });
  if (!block) return res.status(404).json({ error: "not found" });
  res.json(block);
});

app.delete("/api/blocks/:id", (req, res) => {
  mutate((db) => {
    db.blocks = db.blocks.filter((b) => b.id !== req.params.id);
  });
  res.json({ ok: true });
});

/* --------------------------- Decisions --------------------------- */

app.get("/api/decisions", (_req, res) => {
  const d = [...getDb().decisions].sort((a, b) => {
    if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  res.json(d);
});

app.post("/api/decisions", (req, res) => {
  const b = req.body ?? {};
  if (!b.title?.trim()) return res.status(400).json({ error: "title required" });
  const decision: Decision = {
    id: id("dec"),
    title: String(b.title).trim(),
    context: b.context,
    status: "pending",
    owner: b.owner,
    deadline: b.deadline,
    createdAt: nowIso(),
  };
  mutate((db) => db.decisions.push(decision));
  res.status(201).json(decision);
});

app.patch("/api/decisions/:id", (req, res) => {
  const b = req.body ?? {};
  const decision = mutate((db) => {
    const d = db.decisions.find((d) => d.id === req.params.id);
    if (!d) return null;
    Object.assign(d, {
      title: b.title ?? d.title,
      context: b.context ?? d.context,
      owner: b.owner ?? d.owner,
      deadline: b.deadline ?? d.deadline,
      outcome: b.outcome ?? d.outcome,
      followUpDate: b.followUpDate ?? d.followUpDate,
    });
    if (b.status && b.status !== d.status) {
      d.status = b.status;
      d.decidedAt = b.status === "decided" ? nowIso() : undefined;
    }
    return d;
  });
  if (!decision) return res.status(404).json({ error: "not found" });
  res.json(decision);
});

app.delete("/api/decisions/:id", (req, res) => {
  mutate((db) => {
    db.decisions = db.decisions.filter((d) => d.id !== req.params.id);
  });
  res.json({ ok: true });
});

/* -------------------------- Delegations -------------------------- */

app.get("/api/delegations", (_req, res) => {
  res.json(getDb().delegations);
});

app.post("/api/delegations", (req, res) => {
  const b = req.body ?? {};
  if (!b.matter?.trim() || !b.owner?.trim()) {
    return res.status(400).json({ error: "matter and owner required" });
  }
  const del: Delegation = {
    id: id("del"),
    matter: String(b.matter).trim(),
    owner: String(b.owner).trim(),
    expectedResult: b.expectedResult ?? "",
    deadline: b.deadline,
    status: b.status ?? "in-progress",
    createdAt: nowIso(),
  };
  mutate((db) => db.delegations.push(del));
  res.status(201).json(del);
});

app.patch("/api/delegations/:id", (req, res) => {
  const patch = pick<Delegation>(req.body ?? {}, [
    "matter",
    "owner",
    "expectedResult",
    "deadline",
    "status",
  ]);
  const err = invalid(patch, {
    matter: isStr,
    owner: isStr,
    expectedResult: isStr,
    deadline: isDateStr,
    status: isOneOf(DELEGATION_STATUSES),
  });
  if (err) return res.status(400).json({ error: err });
  const del = mutate((db) => {
    const d = db.delegations.find((d) => d.id === req.params.id);
    if (!d) return null;
    Object.assign(d, patch);
    return d;
  });
  if (!del) return res.status(404).json({ error: "not found" });
  res.json(del);
});

app.delete("/api/delegations/:id", (req, res) => {
  mutate((db) => {
    db.delegations = db.delegations.filter((d) => d.id !== req.params.id);
  });
  res.json({ ok: true });
});

app.get("/api/delegations/:id/reminder", (req, res) => {
  const d = getDb().delegations.find((d) => d.id === req.params.id);
  if (!d) return res.status(404).json({ error: "not found" });
  res.json({ text: delegationReminderText(d) });
});

/* ---------------------------- Meetings --------------------------- */

app.get("/api/meetings", (_req, res) => {
  const meetings = getDb().meetings.map((m) => ({
    ...m,
    warning: m.decisionsRequired?.trim()
      ? null
      : "This meeting has no clear decision required. Consider cancelling it or turning it into a written update.",
  }));
  res.json(meetings);
});

app.post("/api/meetings", (req, res) => {
  const b = req.body ?? {};
  if (!b.title?.trim()) return res.status(400).json({ error: "title required" });
  const meeting: Meeting = {
    id: id("mtg"),
    title: String(b.title).trim(),
    when: b.when,
    goal: b.goal ?? "",
    decisionsRequired: b.decisionsRequired ?? "",
    numbersToReview: b.numbersToReview,
    questions: b.questions,
    actionOwner: b.actionOwner,
    deadline: b.deadline,
    createdAt: nowIso(),
  };
  mutate((db) => db.meetings.push(meeting));
  res.status(201).json(meeting);
});

app.patch("/api/meetings/:id", (req, res) => {
  const patch = pick<Meeting>(req.body ?? {}, [
    "title",
    "when",
    "goal",
    "decisionsRequired",
    "numbersToReview",
    "questions",
    "actionOwner",
    "deadline",
    "decisionMade",
    "followUpDate",
  ]);
  const err = invalid(patch, { deadline: isDateStr, followUpDate: isDateStr, title: isStr });
  if (err) return res.status(400).json({ error: err });
  const m = mutate((db) => {
    const mt = db.meetings.find((m) => m.id === req.params.id);
    if (!mt) return null;
    Object.assign(mt, patch);
    return mt;
  });
  if (!m) return res.status(404).json({ error: "not found" });
  res.json(m);
});

app.delete("/api/meetings/:id", (req, res) => {
  mutate((db) => {
    db.meetings = db.meetings.filter((m) => m.id !== req.params.id);
  });
  res.json({ ok: true });
});

/* ------------------------------ Day ------------------------------ */

app.get("/api/day", (req, res) => {
  const date = (req.query.date as string) ?? today();
  const day = getDb().days.find((d) => d.date === date) ?? { date };
  res.json(day);
});

app.put("/api/day", (req, res) => {
  const date = req.body?.date ?? today();
  const day = mutate((db) => {
    let d = db.days.find((d) => d.date === date);
    if (!d) {
      d = { date };
      db.days.push(d);
    }
    if (req.body?.mainGoal !== undefined) d.mainGoal = req.body.mainGoal;
    return d;
  });
  res.json(day);
});

/* ---------------------------- Reviews ---------------------------- */

app.get("/api/reviews/:date", (req, res) => {
  const review = getDb().reviews.find((r) => r.date === req.params.date) ?? {
    date: req.params.date,
  };
  res.json(review);
});

app.put("/api/reviews/:date", (req, res) => {
  const date = req.params.date;
  const patch = pick(req.body ?? {}, [
    "importantResult",
    "timeOverrun",
    "toDelegate",
    "unfinishedDecision",
    "tomorrowPriority",
    "aiSummary",
  ]);
  const review = mutate((db) => {
    let r = db.reviews.find((r) => r.date === date);
    if (!r) {
      r = { date };
      db.reviews.push(r);
    }
    Object.assign(r, patch, { date });
    return r;
  });
  res.json(review);
});

/* ------------------------------ AI ------------------------------- */

app.post("/api/ai/plan", async (req, res) => {
  try {
    const plan = await planDay(getDb(), req.body ?? {});
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/ai/review/:date", async (req, res) => {
  const date = req.params.date;
  try {
    const { summary } = await reviewDay(getDb(), date, req.body ?? {});
    mutate((db) => {
      let r = db.reviews.find((r) => r.date === date);
      if (!r) {
        r = { date };
        db.reviews.push(r);
      }
      r.aiSummary = summary;
    });
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/report", (req, res) => {
  const to = (req.query.to as string) ?? today();
  const from =
    (req.query.from as string) ?? localDate(new Date(Date.now() - 6 * 86400000));
  res.json(timeReport(getDb(), from, to));
});

app.post("/api/chat", async (req, res) => {
  const messages = req.body?.messages as ChatMessage[] | undefined;
  const context = req.body?.context as string | undefined;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages must be a non-empty array" });
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
    for await (const delta of streamChat(messages, context)) {
      send("delta", { text: delta });
    }
    send("done", {});
  } catch (err) {
    send("error", { message: err instanceof Error ? err.message : String(err) });
  } finally {
    res.end();
  }
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`[roy] backend listening on http://localhost:${port} (ai: ${aiEnabled ? "on" : "off"})`);
});

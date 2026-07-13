import Anthropic from "@anthropic-ai/sdk";
import type {
  CalendarBlock,
  Database,
  Delegation,
  InboxClassification,
} from "./types.js";
import { enrich } from "./priority.js";
import { minutesBetween } from "./analytics.js";
import { localDateOf, normalizeHM } from "./dates.js";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

export const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

const client = aiEnabled
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const ASSISTANT_SYSTEM = `You are Roy's chief of staff — an AI assistant embedded in a CEO attention-management app.

Your job is to protect Roy's limited attention, decisions and leadership time.
When Roy asks about a task, always push toward one of: focus now, schedule a
block, delegate with a clear owner and deadline, wait on someone, or drop it.

Style:
- Be direct and brief. Roy is busy.
- Think in terms of impact on revenue, customers and the company.
- Default to delegating operational work and reserving Roy's time for
  high-leverage thinking and decisions.
- When you recommend delegating, name a likely owner and a deadline.`;

/** Streaming assistant chat (used on every page). */
export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function* streamChat(messages: ChatMessage[], context?: string) {
  if (!client) {
    yield "The AI assistant is offline — set ANTHROPIC_API_KEY in your .env to enable it.";
    return;
  }
  const system = context
    ? `${ASSISTANT_SYSTEM}\n\nCurrent app context:\n${context}`
    : ASSISTANT_SYSTEM;

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 1500,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

/** Ask Claude for a single JSON object and parse it. */
async function askJson<T>(system: string, user: string): Promise<T> {
  if (!client) throw new Error("AI is offline (no ANTHROPIC_API_KEY set).");
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("AI did not return JSON.");
  }
  return JSON.parse(text.slice(start, end + 1)) as T;
}

const CLASSIFY_VALUES: InboxClassification[] = [
  "do-now",
  "schedule",
  "delegate",
  "waiting",
  "remove",
];

/** Classify a captured thought into the Time Inbox buckets. */
export async function classifyInbox(
  text: string,
): Promise<{ classification: InboxClassification; reason: string }> {
  if (!client) {
    // Heuristic fallback so the app still works with no API key.
    const t = text.toLowerCase();
    let classification: InboxClassification = "schedule";
    if (/\b(ask|tell|talk to|check with|remind)\b/.test(t)) classification = "delegate";
    else if (/\b(wait|waiting|follow up|chase)\b/.test(t)) classification = "waiting";
    else if (/\b(now|urgent|today|asap)\b/.test(t)) classification = "do-now";
    return { classification, reason: "Classified locally (AI offline)." };
  }
  const system = `You classify a CEO's captured thoughts into exactly one bucket:
- "do-now": only the CEO can do it, quick and urgent.
- "schedule": important, needs a focus block.
- "delegate": the team can handle it.
- "waiting": already handed off, awaiting someone else.
- "remove": low value, should not be done by the CEO.
Respond ONLY with JSON: {"classification": "...", "reason": "one short sentence"}.`;
  const result = await askJson<{
    classification: InboxClassification;
    reason: string;
  }>(system, text);
  if (!CLASSIFY_VALUES.includes(result.classification)) {
    result.classification = "schedule";
  }
  return result;
}

export type PlanBlock = {
  start: string;
  end: string;
  title: string;
  type: CalendarBlock["type"];
};

/** The AI daily planner: propose a schedule from today's open work. */
export async function planDay(
  db: Database,
  answers: {
    mainResult?: string;
    focusHours?: number;
  },
): Promise<{ blocks: PlanBlock[]; note: string }> {
  const openTasks = db.tasks
    .filter((t) => t.status === "todo")
    .map(enrich)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(
      (t) =>
        `- ${t.title} [impact:${t.impact}, urgency:${t.urgency}, who:${t.responsibility}, ~${t.timeNeeded}m, rec:${t.recommendationLabel}]`,
    )
    .join("\n");

  const pendingDecisions = db.decisions
    .filter((d) => d.status === "pending")
    .map((d) => `- ${d.title}`)
    .join("\n");

  const waiting = db.delegations
    .filter((d) => d.status !== "done")
    .map((d) => `- ${d.matter} (owner: ${d.owner}, due ${d.deadline ?? "?"})`)
    .join("\n");

  if (!client) {
    // Deterministic fallback plan.
    return {
      blocks: [
        { start: "09:00", end: "10:30", title: answers.mainResult || "Top priority focus block", type: "thinking" },
        { start: "10:30", end: "11:00", title: "Approve pending decisions", type: "decision" },
        { start: "11:00", end: "12:00", title: "Team / marketing review", type: "meeting" },
        { start: "14:00", end: "15:00", title: "Strategy block", type: "thinking" },
        { start: "15:00", end: "15:30", title: "Follow up delegated work", type: "review" },
      ],
      note: "Suggested plan (AI offline). Adjust as needed.",
    };
  }

  const system = `You are a CEO's scheduler. Propose a realistic time-blocked plan for TODAY.
Reserve the CEO's peak morning hours for the single most important result and for CEO thinking.
Group decisions together. Keep meetings tight. Include a short block to follow up delegated work.
Use block types: thinking, decision, meeting, review, people, personal.
Respond ONLY with JSON:
{"blocks":[{"start":"HH:MM","end":"HH:MM","title":"...","type":"thinking"}],"note":"one short sentence"}.`;

  const user = `Most important result today: ${answers.mainResult ?? "(not specified)"}
Focus hours available: ${answers.focusHours ?? "unknown"}

Top open tasks:
${openTasks || "(none)"}

Pending decisions:
${pendingDecisions || "(none)"}

Waiting on others:
${waiting || "(none)"}`;

  const plan = await askJson<{ blocks: PlanBlock[]; note: string }>(system, user);
  return { ...plan, blocks: sanitizePlanBlocks(plan.blocks) };
}

const BLOCK_TYPES: CalendarBlock["type"][] = [
  "thinking",
  "decision",
  "meeting",
  "review",
  "people",
  "personal",
];

/** Normalize model output ("9:00" → "09:00", unknown types → thinking); drop invalid blocks. */
function sanitizePlanBlocks(blocks: PlanBlock[]): PlanBlock[] {
  if (!Array.isArray(blocks)) return [];
  const clean: PlanBlock[] = [];
  for (const b of blocks) {
    const start = normalizeHM(b?.start);
    const end = normalizeHM(b?.end);
    const title = typeof b?.title === "string" ? b.title.trim() : "";
    if (!start || !end || !title) continue;
    const type = BLOCK_TYPES.includes(b.type) ? b.type : "thinking";
    clean.push({ start, end, title, type });
  }
  return clean;
}

/** End-of-day summary + time analysis. */
export async function reviewDay(
  db: Database,
  date: string,
  answers: Record<string, string>,
): Promise<{ summary: string }> {
  const blocks = db.blocks.filter((b) => b.date === date);
  const byType: Record<string, number> = {};
  for (const b of blocks) {
    const mins = minutesBetween(b.start, b.end);
    byType[b.type] = (byType[b.type] ?? 0) + mins;
  }
  const breakdown = Object.entries(byType)
    .map(([type, mins]) => `${type}: ${Math.round(mins / 60 * 10) / 10}h`)
    .join(", ");

  const doneToday = db.tasks.filter(
    (t) => t.status === "done" && t.completedAt && localDateOf(t.completedAt) === date,
  );

  if (!client) {
    return {
      summary: `Time by block today: ${breakdown || "no blocks scheduled"}. Completed ${doneToday.length} task(s). (AI offline — enable ANTHROPIC_API_KEY for a written summary.)`,
    };
  }

  const system = `You produce a short, honest end-of-day summary for a CEO.
Comment on how time split across strategy, meetings and operations, what got done,
and what should be delegated tomorrow. 3–4 sentences max. Respond ONLY with JSON:
{"summary":"..."}.`;

  const user = `Date: ${date}
Time by block type: ${breakdown || "none scheduled"}
Tasks completed today: ${doneToday.map((t) => t.title).join("; ") || "none"}

Roy's answers:
${Object.entries(answers)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n")}`;

  return askJson<{ summary: string }>(system, user);
}

export function delegationReminderText(d: Delegation): string {
  return `Reminder: "${d.matter}" — expected: ${d.expectedResult}${d.deadline ? ` by ${d.deadline}` : ""}.`;
}

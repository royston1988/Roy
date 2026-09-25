import type Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "./claude.js";

export type Tier = "quick" | "standard" | "deep";
export type Mode = "auto" | Tier;

export type ModelChoice = {
  tier: Tier;
  model: string;
  label: string;
  maxTokens: number;
  auto: boolean;
};

export const TIERS: Record<Tier, Omit<ModelChoice, "tier" | "auto">> = {
  quick: {
    model: process.env.MODEL_QUICK ?? "claude-haiku-4-5",
    label: "Haiku 4.5",
    maxTokens: 16000,
  },
  standard: {
    model: process.env.MODEL_STANDARD ?? "claude-sonnet-5",
    label: "Sonnet 5",
    maxTokens: 64000,
  },
  deep: {
    model: process.env.MODEL_DEEP ?? "claude-opus-5",
    label: "Opus 5",
    maxTokens: 64000,
  },
};

export const MODES: Mode[] = ["auto", "quick", "standard", "deep"];

const ROUTER_PROMPT = `You route messages for a coding assistant to the right AI model. Read the conversation and reply with exactly one word: quick, standard, or deep.

quick: greetings, thanks, small talk, simple facts or definitions, short rewrites, one-line fixes, yes/no questions.
standard: everyday coding help: write or explain a function, fix a clear bug, answer a how-to, review a short snippet.
deep: hard work: tricky or multi-file bugs, system design or architecture, big refactors, performance or security analysis, long code or documents, planning with trade-offs, or anything where a mistake would be costly.

Judge the latest user message, using earlier turns only for context (a short follow-up to a hard task is still hard). If unsure between two, pick the higher one.`;

// How much of the recent conversation the router gets to see.
const ROUTER_TURNS = 4;
const ROUTER_CHARS_PER_TURN = 2000;

export async function chooseModel(
  client: Anthropic,
  messages: ChatMessage[],
  mode: Mode,
): Promise<ModelChoice> {
  if (mode !== "auto") return { tier: mode, auto: false, ...TIERS[mode] };

  const tier = await classify(client, messages).catch((err) => {
    console.warn("[jarvis] router failed, using heuristic:", err?.message ?? err);
    return heuristic(messages);
  });
  return { tier, auto: true, ...TIERS[tier] };
}

async function classify(client: Anthropic, messages: ChatMessage[]): Promise<Tier> {
  const transcript = messages
    .slice(-ROUTER_TURNS)
    .map((m) => `${m.role.toUpperCase()}: ${clip(m.content)}`)
    .join("\n\n");

  const response = await client.messages.create(
    {
      model: TIERS.quick.model,
      max_tokens: 10,
      system: ROUTER_PROMPT,
      messages: [
        { role: "user", content: `<conversation>\n${transcript}\n</conversation>` },
      ],
    },
    { timeout: 8000, maxRetries: 0 },
  );

  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join(" ")
    .toLowerCase();
  const match = text.match(/\b(quick|standard|deep)\b/);
  if (!match) throw new Error(`unexpected router reply: ${text}`);
  return match[1] as Tier;
}

function clip(text: string) {
  if (text.length <= ROUTER_CHARS_PER_TURN) return text;
  const half = ROUTER_CHARS_PER_TURN / 2;
  return `${text.slice(0, half)}\n…[${text.length - ROUTER_CHARS_PER_TURN} chars cut]…\n${text.slice(-half)}`;
}

const DEEP_WORDS =
  /\b(architect\w*|design|refactor\w*|migrat\w*|optimi[sz]\w*|performance|security|vulnerab\w*|race condition|deadlock|memory leak|algorithm\w*|trade-?offs?|scal\w+|strategy|plan)\b/i;
const QUICK_WORDS =
  /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|cool|great)\b|^(what is|what's|define|translate|rename)\b/i;

// Free, instant fallback used when the router call fails.
export function heuristic(messages: ChatMessage[]): Tier {
  const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const text = last.trim();
  const hasCode = text.includes("```");

  if (text.length > 1500 || (hasCode && text.length > 600) || DEEP_WORDS.test(text)) {
    return "deep";
  }
  if (!hasCode && text.length < 120 && QUICK_WORDS.test(text)) return "quick";
  return "standard";
}

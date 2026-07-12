import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are Roy, a calm and practical personal time-management assistant.

You help the user plan their day, prioritize, and protect their focus. When you
have their task list and existing schedule, reason about it concretely:
- Lead with the 1–3 highest-leverage things to do today.
- Suggest a realistic time-blocked schedule that respects existing commitments,
  energy levels (deep work earlier), and rough task estimates.
- Call out overload honestly — if it won't fit, say what to drop or defer.
- Keep it tight and scannable. Use short sections and bullet points, not essays.`;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

async function* streamText(system: string, messages: ChatMessage[]) {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
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

export function streamChat(messages: ChatMessage[]) {
  return streamText(SYSTEM_PROMPT, messages);
}

// Turn a snapshot of tasks + schedule into a natural-language planning request.
export function streamPlan(context: string, request: string) {
  const prompt = `Here is my current state.\n\n${context}\n\n${request}`;
  return streamText(SYSTEM_PROMPT, [{ role: "user", content: prompt }]);
}

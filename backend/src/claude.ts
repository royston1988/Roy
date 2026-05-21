import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are Jarvis, a concise developer coding assistant.

Style:
- Be direct and practical. Skip filler.
- When showing code, prefer minimal complete examples.
- Ask a clarifying question when the request is ambiguous.
- If the user is debugging, propose the most likely cause first, then alternatives.`;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function* streamChat(messages: ChatMessage[]) {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
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

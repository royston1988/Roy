import { useEffect, useRef, useState } from "react";
import { streamChat, type ChatMessage } from "../api";
import { useStore } from "../store";
import { useVoiceInput } from "../ui";

/**
 * Roy's chief-of-staff assistant. Available on every page as a slide-out panel.
 * It receives a short summary of the current state so answers are grounded.
 */
export function Assistant({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const store = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const voice = useVoiceInput((t) => setInput((v) => (v ? v + " " + t : t)));

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streaming]);

  function context(): string {
    const openTasks = store.tasks.filter((t) => t.status === "todo");
    const pending = store.decisions.filter((d) => d.status === "pending");
    const waiting = store.delegations.filter((d) => d.status !== "done");
    return [
      `Today's main goal: ${store.day.mainGoal ?? "(not set)"}`,
      `Open tasks (${openTasks.length}): ${openTasks
        .slice(0, 8)
        .map((t) => `${t.title} [${t.impact}/${t.urgency}, rec ${t.recommendationLabel}]`)
        .join("; ")}`,
      `Pending decisions (${pending.length}): ${pending.map((d) => d.title).join("; ")}`,
      `Waiting on others (${waiting.length}): ${waiting
        .map((d) => `${d.matter}→${d.owner}`)
        .join("; ")}`,
      `Blocks today: ${store.blocks.map((b) => `${b.start}-${b.end} ${b.title}`).join("; ")}`,
    ].join("\n");
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ];
    setMessages(next);
    setInput("");
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    await streamChat(next.slice(0, -1), context(), {
      signal: controller.signal,
      onDelta: (delta) =>
        setMessages((prev) => {
          const copy = prev.slice();
          const last = copy[copy.length - 1];
          if (last?.role === "assistant")
            copy[copy.length - 1] = { ...last, content: last.content + delta };
          return copy;
        }),
      onDone: () => setStreaming(false),
      onError: (m) => {
        setMessages((prev) => {
          const copy = prev.slice();
          const last = copy[copy.length - 1];
          if (last?.role === "assistant")
            copy[copy.length - 1] = { ...last, content: `⚠ ${m}` };
          return copy;
        });
        setStreaming(false);
      },
    });
  }

  if (!open) return null;

  return (
    <div className="assistant">
      <div className="assistant-head">
        <strong>Chief of Staff</strong>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="assistant-body" ref={scrollerRef}>
        {messages.length === 0 && (
          <div className="assistant-empty">
            {store.aiEnabled ? (
              <>
                <p>Ask me what to focus on, what to delegate, or where your time is going.</p>
                <div className="suggestions">
                  {[
                    "What should I focus on right now?",
                    "What can I delegate today?",
                    "Where is my time being wasted?",
                  ].map((s) => (
                    <button key={s} onClick={() => setInput(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p>AI is offline. Set ANTHROPIC_API_KEY in your .env to enable the assistant.</p>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-${m.role}`}>
            {m.content || <span className="thinking">thinking…</span>}
          </div>
        ))}
      </div>
      <div className="assistant-composer">
        {voice.supported && (
          <button
            className={`icon-btn ${voice.listening ? "listening" : ""}`}
            onClick={voice.toggle}
            title="Voice input"
          >
            🎙
          </button>
        )}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Ask your chief of staff…"
          rows={2}
          disabled={streaming}
        />
        <button onClick={() => void send()} disabled={streaming || !input.trim()}>
          {streaming ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}

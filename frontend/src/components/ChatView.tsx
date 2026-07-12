import { useEffect, useRef, useState } from "react";
import { streamChat, type ChatMessage } from "../api";

export default function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streaming]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setError(null);
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ];
    setMessages(next);
    setInput("");
    setStreaming(true);

    await streamChat(next.slice(0, -1), {
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
        setError(m);
        setStreaming(false);
      },
    });
  }

  return (
    <div className="chat">
      <div className="scroller" ref={scrollerRef}>
        {messages.length === 0 && (
          <div className="empty">
            <p>Talk to Roy about your priorities, focus, or planning.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg msg-${m.role}`}>
            <div className="bubble">
              {m.content ||
                (streaming && i === messages.length - 1 ? (
                  <span className="thinking">thinking…</span>
                ) : null)}
            </div>
          </div>
        ))}
        {error && <div className="error">⚠ {error}</div>}
      </div>
      <div className="composer">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message Roy…  (Enter to send, Shift+Enter for newline)"
          rows={2}
          disabled={streaming}
        />
        <button onClick={send} disabled={streaming || !input.trim()}>
          {streaming ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}

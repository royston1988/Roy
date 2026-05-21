import { useEffect, useRef, useState } from "react";
import { streamChat, type ChatMessage } from "./api";

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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

    const controller = new AbortController();
    abortRef.current = controller;

    await streamChat(next.slice(0, -1), {
      signal: controller.signal,
      onDelta: (delta) => {
        setMessages((prev) => {
          const copy = prev.slice();
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = { ...last, content: last.content + delta };
          }
          return copy;
        });
      },
      onDone: () => setStreaming(false),
      onError: (message) => {
        setError(message);
        setStreaming(false);
      },
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const lastIsEmpty =
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant" &&
    messages[messages.length - 1].content === "";

  return (
    <div className="app">
      <header className="header">
        <span className="logo">J</span>
        <div>
          <h1>Jarvis</h1>
          <p className="sub">your coding assistant</p>
        </div>
      </header>

      <div className="scroller" ref={scrollerRef}>
        {messages.length === 0 && (
          <div className="empty">
            <p>Ask Jarvis anything about your code.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg msg-${m.role}`}>
            <div className="bubble">
              {m.content || (streaming && i === messages.length - 1 ? (
                <span className="thinking">thinking…</span>
              ) : null)}
            </div>
          </div>
        ))}
        {error && <div className="error">⚠ {error}</div>}
        {!error && streaming && lastIsEmpty === false && (
          <div className="hint">streaming…</div>
        )}
      </div>

      <div className="composer">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message Jarvis…  (Enter to send, Shift+Enter for newline)"
          rows={3}
          disabled={streaming}
        />
        <button onClick={send} disabled={streaming || !input.trim()}>
          {streaming ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}

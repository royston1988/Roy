import { useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import type { InboxClassification, InboxItem } from "../types";
import { CLASSIFY_LABEL, Pill, useVoiceInput } from "../ui";

const CLASSIFICATIONS: InboxClassification[] = [
  "do-now",
  "schedule",
  "delegate",
  "waiting",
  "remove",
];

const TONE: Record<InboxClassification, "green" | "blue" | "purple" | "yellow" | "red"> = {
  "do-now": "green",
  schedule: "blue",
  delegate: "purple",
  waiting: "yellow",
  remove: "red",
};

export function Inbox() {
  const store = useStore();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const voice = useVoiceInput((t) => setText((v) => (v ? v + " " + t : t)));

  async function add() {
    const t = text.trim();
    if (!t) return;
    setText("");
    await api.post("/inbox", { text: t });
    await store.refresh();
  }

  async function classify(item: InboxItem) {
    setBusy(item.id);
    try {
      const res = await api.post<InboxItem & { reason?: string }>(
        `/inbox/${item.id}/classify`,
      );
      await store.refresh();
      if (res.classification && res.reason) {
        alert(`${CLASSIFY_LABEL[res.classification]} — ${res.reason}`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "classification failed");
    } finally {
      setBusy(null);
    }
  }

  async function setClass(item: InboxItem, c: InboxClassification) {
    await api.patch(`/inbox/${item.id}`, { classification: c });
    await store.refresh();
  }

  async function promote(item: InboxItem) {
    const c = item.classification;
    if (c === "delegate" || c === "waiting") {
      const owner = prompt("Delegate to (owner name)?") ?? "";
      if (!owner.trim()) return;
      await api.post("/delegations", {
        matter: item.text,
        owner: owner.trim(),
        expectedResult: "",
        status: c === "waiting" ? "waiting" : "in-progress",
      });
    } else if (c === "remove") {
      await api.del(`/inbox/${item.id}`);
      await store.refresh();
      return;
    } else {
      // do-now / schedule → a task
      await api.post("/tasks", {
        title: item.text,
        urgency: c === "do-now" ? "today" : "week",
        impact: "medium",
        responsibility: c === "do-now" ? "only-roy" : "roy-decides",
        timeNeeded: 30,
      });
    }
    await api.patch(`/inbox/${item.id}`, { processed: true });
    await store.refresh();
  }

  return (
    <div className="page">
      <div className="capture">
        {voice.supported && (
          <button
            className={`icon-btn big ${voice.listening ? "listening" : ""}`}
            onClick={voice.toggle}
            title="Voice capture"
          >
            🎙
          </button>
        )}
        <input
          className="capture-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Capture anything on your mind… (Enter to add)"
          autoFocus
        />
        <button className="primary" onClick={add} disabled={!text.trim()}>
          Add
        </button>
      </div>
      <p className="muted small">
        Capture first, decide later. Don't schedule everything — let the AI help you
        classify each item.
      </p>

      {store.inbox.length === 0 ? (
        <div className="empty-state">
          <p>Your mind is clear. Nothing waiting in the inbox.</p>
        </div>
      ) : (
        <ul className="inbox-list">
          {store.inbox.map((item) => (
            <li key={item.id} className="inbox-item">
              <div className="inbox-top">
                <span className="grow">{item.text}</span>
                {item.classification && (
                  <Pill tone={TONE[item.classification]}>
                    {CLASSIFY_LABEL[item.classification]}
                  </Pill>
                )}
              </div>
              <div className="inbox-actions">
                {!item.classification ? (
                  <button
                    className="chip ai"
                    disabled={busy === item.id}
                    onClick={() => classify(item)}
                  >
                    {busy === item.id ? "classifying…" : "✨ AI classify"}
                  </button>
                ) : (
                  <select
                    value={item.classification}
                    onChange={(e) =>
                      setClass(item, e.target.value as InboxClassification)
                    }
                  >
                    {CLASSIFICATIONS.map((c) => (
                      <option key={c} value={c}>
                        {CLASSIFY_LABEL[c]}
                      </option>
                    ))}
                  </select>
                )}
                {item.classification && (
                  <button className="chip" onClick={() => promote(item)}>
                    {item.classification === "remove"
                      ? "Remove"
                      : item.classification === "delegate" ||
                          item.classification === "waiting"
                        ? "→ Delegation"
                        : "→ Task"}
                  </button>
                )}
                <button
                  className="chip ghost"
                  onClick={async () => {
                    await api.del(`/inbox/${item.id}`);
                    await store.refresh();
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

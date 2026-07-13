import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useStore, todayStr } from "../store";

const STORAGE_KEY = "roy.focusSession";

type Session = { what: string; startedAt: number };

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return typeof s?.startedAt === "number" ? s : null;
  } catch {
    return null;
  }
}

function toHM(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * The "Start Focus Session" tracker on the Today dashboard.
 * Elapsed time is computed from the wall clock (immune to background-tab
 * throttling), the running session survives navigation via localStorage, and
 * ending a session records it as a CEO Thinking block so focus time actually
 * feeds the daily/weekly time reports.
 */
export function FocusSession() {
  const store = useStore();
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [what, setWhat] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (session) {
      timer.current = setInterval(() => setNow(Date.now()), 1000);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [session]);

  const suggestion =
    store.tasks.find((t) => t.status === "todo" && t.isTopPriority)?.title ??
    store.tasks.find((t) => t.status === "todo")?.title ??
    "";

  function start() {
    const s: Session = {
      what: what.trim() || suggestion || "Focus session",
      startedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    setNow(Date.now());
    setSession(s);
  }

  async function end() {
    if (!session) return;
    const endedAt = Date.now();
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    // Record sessions of a minute or more so they count in the time reports.
    if (endedAt - session.startedAt >= 60_000) {
      const start = toHM(session.startedAt);
      const endHM = toHM(endedAt);
      if (start !== endHM) {
        setSaving(true);
        try {
          await api.post("/blocks", {
            date: todayStr(),
            start,
            end: endHM,
            title: `Focus: ${session.what}`,
            type: "thinking",
          });
          await store.refresh();
        } finally {
          setSaving(false);
        }
      }
    }
  }

  if (!session) {
    return (
      <div className="focus focus-idle">
        <div className="focus-left">
          <span className="eyebrow">Right now</span>
          <input
            className="focus-input"
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            placeholder={suggestion ? `What are you working on? (e.g. ${suggestion})` : "What are you working on?"}
          />
        </div>
        <button className="focus-btn" onClick={start} disabled={saving}>
          {saving ? "Saving…" : "▶ Start Focus Session"}
        </button>
      </div>
    );
  }

  const seconds = Math.max(0, Math.floor((now - session.startedAt) / 1000));
  const hh = Math.floor(seconds / 3600);
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="focus focus-running">
      <div className="focus-left">
        <span className="eyebrow">Focusing on</span>
        <strong className="focus-what">{session.what}</strong>
      </div>
      <div className="focus-timer">
        {hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`}
      </div>
      <button className="focus-btn stop" onClick={() => void end()}>
        ■ End
      </button>
    </div>
  );
}

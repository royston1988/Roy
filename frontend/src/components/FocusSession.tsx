import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";

/** The "Start Focus Session" tracker on the Today dashboard. */
export function FocusSession() {
  const store = useStore();
  const [running, setRunning] = useState(false);
  const [what, setWhat] = useState("");
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (timer.current) {
      clearInterval(timer.current);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [running]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const suggestion =
    store.tasks.find((t) => t.status === "todo" && t.isTopPriority)?.title ??
    store.tasks.find((t) => t.status === "todo")?.title ??
    "";

  if (!running) {
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
        <button
          className="focus-btn"
          onClick={() => {
            if (!what.trim() && suggestion) setWhat(suggestion);
            setSeconds(0);
            setRunning(true);
          }}
        >
          ▶ Start Focus Session
        </button>
      </div>
    );
  }

  return (
    <div className="focus focus-running">
      <div className="focus-left">
        <span className="eyebrow">Focusing on</span>
        <strong className="focus-what">{what || "Focus session"}</strong>
      </div>
      <div className="focus-timer">
        {mm}:{ss}
      </div>
      <button className="focus-btn stop" onClick={() => setRunning(false)}>
        ■ End
      </button>
    </div>
  );
}

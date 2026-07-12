import { useEffect, useRef, useState } from "react";
import type { Task } from "../api";
import { logSession } from "../api";
import { fmtDuration } from "../util";

type Props = {
  task: Task | null;
  onClear: () => void;
  onLogged: () => void;
};

const FOCUS_MIN = 25;
const BREAK_MIN = 5;

export default function Pomodoro({ task, onClear, onLogged }: Props) {
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [remaining, setRemaining] = useState(FOCUS_MIN * 60);
  const [running, setRunning] = useState(false);
  const startedAt = useRef<string | null>(null);
  const elapsedRef = useRef(0);

  const total = (mode === "focus" ? FOCUS_MIN : BREAK_MIN) * 60;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          finish();
          return 0;
        }
        elapsedRef.current += 1;
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode]);

  function start() {
    if (!startedAt.current) startedAt.current = new Date().toISOString();
    setRunning(true);
  }

  function pause() {
    setRunning(false);
  }

  async function finish() {
    setRunning(false);
    if (mode === "focus" && elapsedRef.current > 0) {
      await logSession({
        task_id: task?.id ?? null,
        kind: "pomodoro",
        started_at: startedAt.current ?? new Date().toISOString(),
        ended_at: new Date().toISOString(),
        seconds: elapsedRef.current,
      });
      onLogged();
    }
    reset(mode === "focus" ? "break" : "focus");
  }

  function reset(next: "focus" | "break") {
    setMode(next);
    setRemaining((next === "focus" ? FOCUS_MIN : BREAK_MIN) * 60);
    startedAt.current = null;
    elapsedRef.current = 0;
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const pct = ((total - remaining) / total) * 100;

  return (
    <div className={`pomodoro ${mode}`}>
      <div className="pomo-head">
        <span className="pomo-mode">{mode === "focus" ? "Focus" : "Break"}</span>
        {task && (
          <span className="pomo-task">
            {task.title}
            <button className="icon tiny" title="Clear task" onClick={onClear}>
              ✕
            </button>
          </span>
        )}
      </div>
      <div className="pomo-clock">
        {mm}:{ss}
      </div>
      <div className="pomo-bar">
        <div className="pomo-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="pomo-controls">
        {!running ? (
          <button onClick={start}>{remaining < total ? "Resume" : "Start"}</button>
        ) : (
          <button onClick={pause}>Pause</button>
        )}
        <button className="ghost" onClick={finish}>
          {mode === "focus" ? "Finish & log" : "Skip"}
        </button>
        <button className="ghost" onClick={() => reset(mode)}>
          Reset
        </button>
      </div>
      {elapsedRef.current > 0 && running === false && mode === "focus" && (
        <p className="muted small">Logged so far: {fmtDuration(elapsedRef.current)}</p>
      )}
    </div>
  );
}

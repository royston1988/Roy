import { useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import type {
  Impact,
  Responsibility,
  Task,
  TaskDecision,
  TimeNeeded,
  Urgency,
} from "../types";
import {
  DECISION_LABEL,
  IMPACT_LABEL,
  Pill,
  RESP_LABEL,
  TIME_LABEL,
  URGENCY_LABEL,
} from "../ui";

const IMPACTS: Impact[] = ["high", "medium", "low"];
const URGENCIES: Urgency[] = ["today", "week", "later"];
const RESPS: Responsibility[] = ["only-roy", "roy-decides", "team", "should-not"];
const TIMES: TimeNeeded[] = [15, 30, 60, 120];

const DECISION_TONE: Record<TaskDecision, "green" | "blue" | "purple" | "red"> = {
  "do-today": "green",
  schedule: "blue",
  delegate: "purple",
  remove: "red",
};

export function Priorities() {
  const store = useStore();
  const [title, setTitle] = useState("");
  const [impact, setImpact] = useState<Impact>("high");
  const [urgency, setUrgency] = useState<Urgency>("today");
  const [responsibility, setResponsibility] = useState<Responsibility>("roy-decides");
  const [timeNeeded, setTimeNeeded] = useState<TimeNeeded>(30);
  const [showDone, setShowDone] = useState(false);

  const open = store.tasks.filter((t) => t.status === "todo");
  const done = store.tasks.filter((t) => t.status === "done");

  async function add() {
    if (!title.trim()) return;
    await api.post("/tasks", {
      title,
      impact,
      urgency,
      responsibility,
      timeNeeded,
    });
    setTitle("");
    await store.refresh();
  }

  async function update(t: Task, patch: Partial<Task>) {
    await api.patch(`/tasks/${t.id}`, patch);
    await store.refresh();
  }

  return (
    <div className="page">
      <section className="card">
        <div className="card-head">
          <h2>CEO Priority System</h2>
        </div>
        <p className="muted small">
          Score any task with four questions. Roy computes a priority score and
          recommends whether to do it today, schedule it, delegate it, or drop it.
        </p>
        <div className="task-form">
          <input
            className="grow"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="New task…"
          />
          <select value={impact} onChange={(e) => setImpact(e.target.value as Impact)}>
            {IMPACTS.map((i) => (
              <option key={i} value={i}>
                Impact: {IMPACT_LABEL[i]}
              </option>
            ))}
          </select>
          <select value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)}>
            {URGENCIES.map((u) => (
              <option key={u} value={u}>
                {URGENCY_LABEL[u]}
              </option>
            ))}
          </select>
          <select
            value={responsibility}
            onChange={(e) => setResponsibility(e.target.value as Responsibility)}
          >
            {RESPS.map((r) => (
              <option key={r} value={r}>
                {RESP_LABEL[r]}
              </option>
            ))}
          </select>
          <select
            value={timeNeeded}
            onChange={(e) => setTimeNeeded(Number(e.target.value) as TimeNeeded)}
          >
            {TIMES.map((t) => (
              <option key={t} value={t}>
                {TIME_LABEL[t]}
              </option>
            ))}
          </select>
          <button className="primary" onClick={add}>
            Add
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Priorities ({open.length})</h2>
          {done.length > 0 && (
            <button className="link" onClick={() => setShowDone((s) => !s)}>
              {showDone ? "hide" : "show"} completed ({done.length})
            </button>
          )}
        </div>
        {open.length === 0 && <p className="muted">No open tasks. Add one above.</p>}
        <div className="table-scroll">
          <table className="ptable">
            <thead>
              <tr>
                <th></th>
                <th>Task</th>
                <th>Impact</th>
                <th>Urgency</th>
                <th>Who</th>
                <th>Time</th>
                <th>Score</th>
                <th>Recommendation</th>
                <th>Top 3</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {open.map((t) => (
                <tr key={t.id}>
                  <td>
                    <button
                      className="check"
                      title="Mark done"
                      onClick={() => update(t, { status: "done" })}
                    >
                      ○
                    </button>
                  </td>
                  <td className="title-cell">{t.title}</td>
                  <td>
                    <select
                      value={t.impact}
                      onChange={(e) => update(t, { impact: e.target.value as Impact })}
                    >
                      {IMPACTS.map((i) => (
                        <option key={i} value={i}>
                          {IMPACT_LABEL[i]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={t.urgency}
                      onChange={(e) => update(t, { urgency: e.target.value as Urgency })}
                    >
                      {URGENCIES.map((u) => (
                        <option key={u} value={u}>
                          {URGENCY_LABEL[u]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={t.responsibility}
                      onChange={(e) =>
                        update(t, {
                          responsibility: e.target.value as Responsibility,
                        })
                      }
                    >
                      {RESPS.map((r) => (
                        <option key={r} value={r}>
                          {RESP_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={t.timeNeeded}
                      onChange={(e) =>
                        update(t, { timeNeeded: Number(e.target.value) as TimeNeeded })
                      }
                    >
                      {TIMES.map((tm) => (
                        <option key={tm} value={tm}>
                          {TIME_LABEL[tm]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Pill tone={t.score >= 70 ? "red" : t.score >= 45 ? "yellow" : "neutral"}>
                      {t.score}
                    </Pill>
                  </td>
                  <td>
                    <Pill tone={DECISION_TONE[t.recommendation]}>
                      {DECISION_LABEL[t.recommendation]}
                    </Pill>
                  </td>
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(t.isTopPriority)}
                      onChange={(e) => update(t, { isTopPriority: e.target.checked })}
                    />
                  </td>
                  <td>
                    <button
                      className="icon-btn"
                      title="Delete"
                      onClick={async () => {
                        await api.del(`/tasks/${t.id}`);
                        await store.refresh();
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showDone && (
          <ul className="done-list">
            {done.map((t) => (
              <li key={t.id}>
                <span className="grow strike">{t.title}</span>
                <button className="link" onClick={() => update(t, { status: "todo" })}>
                  reopen
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

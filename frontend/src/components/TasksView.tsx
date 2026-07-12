import { useState } from "react";
import type { Task } from "../api";
import { addTask, patchTask, removeTask } from "../api";
import { priorityLabel } from "../util";

type Props = {
  tasks: Task[];
  reload: () => void;
  activeTaskId: string | null;
  onFocus: (t: Task) => void;
};

export default function TasksView({ tasks, reload, activeTaskId, onFocus }: Props) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState(2);
  const [due, setDue] = useState("");
  const [estimate, setEstimate] = useState("");
  const [project, setProject] = useState("");

  async function create() {
    const t = title.trim();
    if (!t) return;
    await addTask({
      title: t,
      priority,
      due_date: due || null,
      estimate_min: estimate ? Number(estimate) : null,
      project: project.trim(),
    });
    setTitle("");
    setDue("");
    setEstimate("");
    setProject("");
    reload();
  }

  async function cycleStatus(task: Task) {
    const next =
      task.status === "todo" ? "doing" : task.status === "doing" ? "done" : "todo";
    await patchTask(task.id, { status: next });
    reload();
  }

  async function toggleTop3(task: Task) {
    await patchTask(task.id, { is_top3: task.is_top3 ? 0 : 1 });
    reload();
  }

  const top3 = tasks.filter((t) => t.is_top3 && t.status !== "done");
  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div className="stack">
      <div className="card">
        <div className="composer-row">
          <input
            className="grow"
            value={title}
            placeholder="Add a task…"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <button onClick={create} disabled={!title.trim()}>
            Add
          </button>
        </div>
        <div className="composer-row meta-row">
          <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
            <option value={1}>P1 · High</option>
            <option value={2}>P2 · Medium</option>
            <option value={3}>P3 · Low</option>
          </select>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <input
            className="narrow"
            type="number"
            min={0}
            placeholder="est min"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
          />
          <input
            className="narrow"
            placeholder="project"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          />
        </div>
      </div>

      {top3.length > 0 && (
        <div className="card">
          <h3 className="section-title">★ Top 3 for today</h3>
          {top3.map((t) => (
            <Row
              key={t.id}
              t={t}
              active={t.id === activeTaskId}
              onCycle={cycleStatus}
              onTop3={toggleTop3}
              onFocus={onFocus}
              onDelete={async (id) => (await removeTask(id), reload())}
            />
          ))}
        </div>
      )}

      <div className="card">
        <h3 className="section-title">Open · {open.length}</h3>
        {open.length === 0 && <p className="muted">Nothing open. Nice.</p>}
        {open.map((t) => (
          <Row
            key={t.id}
            t={t}
            active={t.id === activeTaskId}
            onCycle={cycleStatus}
            onTop3={toggleTop3}
            onFocus={onFocus}
            onDelete={async (id) => (await removeTask(id), reload())}
          />
        ))}
      </div>

      {done.length > 0 && (
        <div className="card">
          <h3 className="section-title">Done · {done.length}</h3>
          {done.map((t) => (
            <Row
              key={t.id}
              t={t}
              active={false}
              onCycle={cycleStatus}
              onTop3={toggleTop3}
              onFocus={onFocus}
              onDelete={async (id) => (await removeTask(id), reload())}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  t,
  active,
  onCycle,
  onTop3,
  onFocus,
  onDelete,
}: {
  t: Task;
  active: boolean;
  onCycle: (t: Task) => void;
  onTop3: (t: Task) => void;
  onFocus: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const overdue =
    t.due_date && t.status !== "done" && t.due_date < new Date().toISOString().slice(0, 10);
  return (
    <div className={`task ${t.status} ${active ? "active" : ""}`}>
      <button
        className={`checkbox s-${t.status}`}
        title={t.status}
        onClick={() => onCycle(t)}
      >
        {t.status === "done" ? "✓" : t.status === "doing" ? "◐" : ""}
      </button>
      <div className="task-main">
        <span className={`task-title ${t.status === "done" ? "struck" : ""}`}>
          {t.title}
        </span>
        <div className="chips">
          <span className={`chip p${t.priority}`}>{priorityLabel(t.priority)}</span>
          {t.project && <span className="chip">#{t.project}</span>}
          {t.estimate_min ? <span className="chip">~{t.estimate_min}m</span> : null}
          {t.due_date && (
            <span className={`chip ${overdue ? "danger" : ""}`}>
              {overdue ? "⚠ " : ""}
              {t.due_date}
            </span>
          )}
        </div>
      </div>
      <div className="task-actions">
        <button
          className={`icon ${t.is_top3 ? "on" : ""}`}
          title="Top 3"
          onClick={() => onTop3(t)}
        >
          ★
        </button>
        {t.status !== "done" && (
          <button className="icon" title="Focus timer" onClick={() => onFocus(t)}>
            ▶
          </button>
        )}
        <button className="icon" title="Delete" onClick={() => onDelete(t.id)}>
          ✕
        </button>
      </div>
    </div>
  );
}

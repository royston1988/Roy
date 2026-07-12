import { useEffect, useState } from "react";
import type { Stats } from "../api";
import { getStats } from "../api";
import { fmtDuration, priorityLabel } from "../util";

export default function ReviewView({ refreshKey }: { refreshKey: number }) {
  const [days, setDays] = useState(7);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    getStats(days).then(setStats);
  }, [days, refreshKey]);

  if (!stats) return <div className="card muted">Loading…</div>;

  const maxProj = Math.max(1, ...stats.focus_by_project.map((p) => p.seconds));

  return (
    <div className="stack">
      <div className="card">
        <div className="composer-row">
          <h3 className="section-title grow">Review · last {days} days</h3>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={1}>1 day</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
          </select>
        </div>
        <div className="stat-grid">
          <Stat label="Completed" value={String(stats.completed)} />
          <Stat label="Created" value={String(stats.created)} />
          <Stat label="Focus time" value={fmtDuration(stats.focus_seconds)} />
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Open work by priority</h3>
        {stats.open_by_priority.length === 0 && (
          <p className="muted">No open tasks. Inbox zero.</p>
        )}
        {stats.open_by_priority
          .sort((a, b) => a.priority - b.priority)
          .map((p) => (
            <div key={p.priority} className="bar-row">
              <span className={`chip p${p.priority}`}>{priorityLabel(p.priority)}</span>
              <span className="bar-count">{p.n}</span>
            </div>
          ))}
      </div>

      <div className="card">
        <h3 className="section-title">Focus time by project</h3>
        {stats.focus_by_project.length === 0 && (
          <p className="muted">No tracked focus sessions yet — run a Pomodoro.</p>
        )}
        {stats.focus_by_project.map((p) => (
          <div key={p.project} className="bar-row">
            <span className="bar-label">{p.project}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(p.seconds / maxProj) * 100}%` }}
              />
            </div>
            <span className="bar-count">{fmtDuration(p.seconds)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

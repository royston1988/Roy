import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useStore, todayStr } from "../store";
import { BLOCK_LABEL, isOverdue, Pill } from "../ui";
import { FocusSession } from "../components/FocusSession";

export function Today({ go }: { go: (page: string) => void }) {
  const store = useStore();
  const [goal, setGoal] = useState("");
  const [goalDirty, setGoalDirty] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  // Sync store → input only while the user isn't mid-edit, so a refresh
  // finishing after blur can't clobber new keystrokes.
  useEffect(() => {
    if (!goalDirty) setGoal(store.day.mainGoal ?? "");
  }, [store.day.mainGoal, goalDirty]);

  async function saveGoal() {
    setSavingGoal(true);
    try {
      await api.put("/day", { date: todayStr(), mainGoal: goal });
      setGoalDirty(false);
      await store.refresh();
    } finally {
      setSavingGoal(false);
    }
  }

  const top3 = useMemo(() => {
    const pinned = store.tasks.filter((t) => t.status === "todo" && t.isTopPriority);
    if (pinned.length >= 3) return pinned.slice(0, 3);
    const rest = store.tasks
      .filter((t) => t.status === "todo" && !t.isTopPriority)
      .slice(0, 3 - pinned.length);
    return [...pinned, ...rest];
  }, [store.tasks]);

  const pendingDecisions = store.decisions.filter((d) => d.status === "pending");
  const now = new Date();
  const nowHM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="page">
      <div className="goal-card">
        <span className="eyebrow">Today's main goal</span>
        <div className="goal-row">
          <input
            className="goal-input"
            value={goal}
            onChange={(e) => {
              setGoal(e.target.value);
              setGoalDirty(true);
            }}
            onBlur={() => void saveGoal()}
            placeholder="e.g. Increase live traffic and improve sales conversion"
          />
          {savingGoal && <span className="muted small">saving…</span>}
        </div>
      </div>

      <FocusSession />

      <div className="cols">
        <section className="card">
          <div className="card-head">
            <h2>Top 3 priorities</h2>
            <button className="link" onClick={() => go("decisions")}>
              manage
            </button>
          </div>
          {top3.length === 0 && (
            <p className="muted">
              No priorities yet. Capture work in the{" "}
              <button className="link" onClick={() => go("inbox")}>
                Inbox
              </button>{" "}
              and prioritize it.
            </p>
          )}
          <ol className="priority-list">
            {top3.map((t) => (
              <li key={t.id}>
                <button
                  className="check"
                  title="Mark done"
                  onClick={async () => {
                    await api.patch(`/tasks/${t.id}`, { status: "done" });
                    await store.refresh();
                  }}
                >
                  ○
                </button>
                <span className="grow">{t.title}</span>
                <Pill tone={t.score >= 70 ? "red" : t.score >= 45 ? "yellow" : "neutral"}>
                  {t.score}
                </Pill>
              </li>
            ))}
          </ol>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Today's schedule</h2>
            <button className="link" onClick={() => go("calendar")}>
              open calendar
            </button>
          </div>
          {store.blocks.length === 0 && (
            <p className="muted">No time blocks yet. Plan your day in the Calendar.</p>
          )}
          <ul className="schedule">
            {store.blocks.map((b) => {
              const current = b.start <= nowHM && nowHM < b.end && b.date === todayStr();
              return (
                <li key={b.id} className={current ? "current" : ""}>
                  <span className="time">
                    {b.start}–{b.end}
                  </span>
                  <span className={`dot dot-${b.type}`} />
                  <span className="grow">{b.title}</span>
                  <span className="muted small">{BLOCK_LABEL[b.type]}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="cols">
        <section className="card compact">
          <h2>Decisions waiting for you</h2>
          {pendingDecisions.length === 0 ? (
            <p className="muted">Nothing waiting on your approval.</p>
          ) : (
            <ul className="mini-list">
              {pendingDecisions.slice(0, 4).map((d) => (
                <li key={d.id}>
                  <Pill tone="yellow">pending</Pill>
                  <span className="grow">{d.title}</span>
                </li>
              ))}
            </ul>
          )}
          <button className="link" onClick={() => go("decisions")}>
            go to Decisions →
          </button>
        </section>

        <section className="card compact">
          <h2>Waiting on others</h2>
          {store.delegations.filter((d) => d.status !== "done").length === 0 ? (
            <p className="muted">Nothing delegated right now.</p>
          ) : (
            <ul className="mini-list">
              {store.delegations
                .filter((d) => d.status !== "done")
                .slice(0, 4)
                .map((d) => (
                  <li key={d.id}>
                    <Pill tone={d.status === "delayed" || isOverdue(d.deadline) ? "red" : "blue"}>
                      {d.owner}
                    </Pill>
                    <span className="grow">{d.matter}</span>
                  </li>
                ))}
            </ul>
          )}
          <button className="link" onClick={() => go("delegation")}>
            go to Delegation →
          </button>
        </section>
      </div>
    </div>
  );
}

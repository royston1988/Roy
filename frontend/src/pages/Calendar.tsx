import { useMemo, useState } from "react";
import { api } from "../api";
import { useStore, todayStr } from "../store";
import type { BlockType, PlanBlock } from "../types";
import { BLOCK_LABEL } from "../ui";

const TYPES: BlockType[] = [
  "thinking",
  "decision",
  "meeting",
  "review",
  "people",
  "personal",
];

// Which block types are high-value CEO time vs operational.
const CEO_TYPES: BlockType[] = ["thinking", "decision", "people"];

function mins(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

export function Calendar() {
  const store = useStore();
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<BlockType>("thinking");
  const [plan, setPlan] = useState<PlanBlock[] | null>(null);
  const [planNote, setPlanNote] = useState("");
  const [planning, setPlanning] = useState(false);
  const [mainResult, setMainResult] = useState("");
  const [focusHours, setFocusHours] = useState("");

  const blocks = store.blocks;

  const balance = useMemo(() => {
    let ceo = 0;
    let ops = 0;
    for (const b of blocks) {
      const m = mins(b.start, b.end);
      if (CEO_TYPES.includes(b.type)) ceo += m;
      else ops += m;
    }
    const total = ceo + ops;
    return {
      ceoPct: total ? Math.round((ceo / total) * 100) : 0,
      opsPct: total ? Math.round((ops / total) * 100) : 0,
      total,
    };
  }, [blocks]);

  async function addBlock() {
    if (!title.trim()) return;
    await api.post("/blocks", { date: todayStr(), start, end, title, type });
    setTitle("");
    await store.refresh();
  }

  async function generatePlan() {
    setPlanning(true);
    setPlan(null);
    try {
      const res = await api.post<{ blocks: PlanBlock[]; note: string }>("/ai/plan", {
        mainResult,
        focusHours: focusHours ? Number(focusHours) : undefined,
      });
      setPlan(res.blocks);
      setPlanNote(res.note);
    } catch (err) {
      setPlanNote(err instanceof Error ? err.message : "planning failed");
    } finally {
      setPlanning(false);
    }
  }

  async function acceptPlan() {
    if (!plan) return;
    try {
      await Promise.all(plan.map((b) => api.post("/blocks", { date: todayStr(), ...b })));
      setPlan(null);
    } catch (err) {
      setPlanNote(err instanceof Error ? err.message : "failed to add blocks");
    } finally {
      await store.refresh();
    }
  }

  return (
    <div className="page">
      <section className="card ai-planner">
        <div className="card-head">
          <h2>✨ AI daily planner</h2>
        </div>
        <p className="muted small">
          Answer two quick questions and Roy proposes a time-blocked day from your open
          work and pending decisions.
        </p>
        <div className="planner-inputs">
          <input
            value={mainResult}
            onChange={(e) => setMainResult(e.target.value)}
            placeholder="Most important result today?"
          />
          <input
            value={focusHours}
            onChange={(e) => setFocusHours(e.target.value)}
            placeholder="Focus hours available?"
            type="number"
            min="0"
            max="12"
          />
          <button className="primary" onClick={generatePlan} disabled={planning}>
            {planning ? "Thinking…" : "Propose plan"}
          </button>
        </div>
        {planNote && !plan && <p className="muted small">{planNote}</p>}
        {plan && (
          <div className="proposed">
            <div className="proposed-head">
              <strong>Recommended plan</strong>
              <span className="muted small">{planNote}</span>
            </div>
            <ul className="schedule">
              {plan.map((b, i) => (
                <li key={i}>
                  <span className="time">
                    {b.start}–{b.end}
                  </span>
                  <span className={`dot dot-${b.type}`} />
                  <span className="grow">{b.title}</span>
                  <span className="muted small">{BLOCK_LABEL[b.type]}</span>
                </li>
              ))}
            </ul>
            <div className="row-actions">
              <button className="primary" onClick={acceptPlan}>
                Add all to today
              </button>
              <button className="chip ghost" onClick={() => setPlan(null)}>
                Discard
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Today — {todayStr()}</h2>
          {balance.total > 0 && (
            <span className={`balance ${balance.ceoPct >= 50 ? "good" : "warn"}`}>
              {balance.ceoPct}% CEO · {balance.opsPct}% operational
            </span>
          )}
        </div>
        {balance.total > 0 && balance.ceoPct < 50 && (
          <p className="warn-text small">
            You're spending more than half your day on operational work. Consider
            delegating or converting a block into CEO thinking time.
          </p>
        )}

        <div className="block-form">
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          <input
            className="grow"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addBlock()}
            placeholder="Block title"
          />
          <select value={type} onChange={(e) => setType(e.target.value as BlockType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {BLOCK_LABEL[t]}
              </option>
            ))}
          </select>
          <button className="primary" onClick={addBlock}>
            Add block
          </button>
        </div>

        {blocks.length === 0 ? (
          <p className="muted">No blocks yet. Add one above or use the AI planner.</p>
        ) : (
          <ul className="schedule big">
            {blocks.map((b) => (
              <li key={b.id}>
                <span className="time">
                  {b.start}–{b.end}
                </span>
                <span className={`dot dot-${b.type}`} />
                <span className="grow">{b.title}</span>
                <span className={`type-tag type-${b.type}`}>{BLOCK_LABEL[b.type]}</span>
                <button
                  className="icon-btn"
                  title="Delete"
                  onClick={async () => {
                    await api.del(`/blocks/${b.id}`);
                    await store.refresh();
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

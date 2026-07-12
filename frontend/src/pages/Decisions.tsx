import { useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import type { Decision, Meeting } from "../types";
import { deadlineTone, Field, Pill } from "../ui";

export function Decisions() {
  const store = useStore();
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [deadline, setDeadline] = useState("");

  const pending = store.decisions.filter((d) => d.status === "pending");
  const decided = store.decisions.filter((d) => d.status === "decided");

  async function add() {
    if (!title.trim()) return;
    await api.post("/decisions", { title, context, deadline: deadline || undefined });
    setTitle("");
    setContext("");
    setDeadline("");
    await store.refresh();
  }

  async function decide(d: Decision) {
    const outcome = prompt(`Decision for "${d.title}"?`) ?? "";
    if (!outcome.trim()) return;
    await api.patch(`/decisions/${d.id}`, { status: "decided", outcome });
    await store.refresh();
  }

  return (
    <div className="page">
      <section className="card">
        <div className="card-head">
          <h2>Decisions waiting for you</h2>
        </div>
        <p className="muted small">
          Matters that need your approval. Yellow = waiting on you, green = decided.
        </p>
        <div className="decision-form">
          <input
            className="grow"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs deciding?"
          />
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          <button className="primary" onClick={add}>
            Add
          </button>
        </div>
        <input
          className="full"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Context (optional)"
        />

        {pending.length === 0 ? (
          <p className="muted">Nothing waiting on your approval.</p>
        ) : (
          <ul className="decision-list">
            {pending.map((d) => (
              <li key={d.id}>
                <div className="decision-main">
                  <Pill tone="yellow">pending</Pill>
                  <div className="grow">
                    <div className="strong">{d.title}</div>
                    {d.context && <div className="muted small">{d.context}</div>}
                  </div>
                  {d.deadline && (
                    <Pill tone={deadlineTone(d.deadline)}>due {d.deadline}</Pill>
                  )}
                </div>
                <div className="row-actions">
                  <button className="chip primary" onClick={() => decide(d)}>
                    Decide
                  </button>
                  <button
                    className="chip ghost"
                    onClick={async () => {
                      await api.del(`/decisions/${d.id}`);
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

        {decided.length > 0 && (
          <>
            <h3 className="section-sub">Decided</h3>
            <ul className="decision-list">
              {decided.map((d) => (
                <li key={d.id}>
                  <div className="decision-main">
                    <Pill tone="green">decided</Pill>
                    <div className="grow">
                      <div className="strong">{d.title}</div>
                      {d.outcome && <div className="muted small">→ {d.outcome}</div>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <MeetingManager />
    </div>
  );
}

function MeetingManager() {
  const store = useStore();
  const empty = {
    title: "",
    when: "",
    goal: "",
    decisionsRequired: "",
    numbersToReview: "",
    questions: "",
    actionOwner: "",
    deadline: "",
  };
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function add() {
    if (!form.title.trim()) return;
    await api.post("/meetings", form);
    setForm(empty);
    setShowForm(false);
    await store.refresh();
  }

  async function recordOutcome(m: Meeting) {
    const decisionMade = prompt(`Decision from "${m.title}"?`) ?? "";
    if (!decisionMade.trim()) return;
    const followUpDate = prompt("Follow-up date (YYYY-MM-DD)?") ?? "";
    await api.patch(`/meetings/${m.id}`, {
      decisionMade,
      followUpDate: followUpDate || undefined,
    });
    await store.refresh();
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Meeting manager</h2>
        <button className="link" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "cancel" : "+ new meeting"}
        </button>
      </div>
      <p className="muted small">
        Every meeting should produce decisions. Roy warns you when one doesn't.
      </p>

      {showForm && (
        <div className="meeting-form">
          <Field label="Meeting title">
            <input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="When">
            <input
              value={form.when}
              onChange={(e) => set("when", e.target.value)}
              placeholder="e.g. Mon 10:00"
            />
          </Field>
          <Field label="Meeting goal">
            <input value={form.goal} onChange={(e) => set("goal", e.target.value)} />
          </Field>
          <Field label="Decisions required">
            <input
              value={form.decisionsRequired}
              onChange={(e) => set("decisionsRequired", e.target.value)}
              placeholder="e.g. Approve Q3 budget"
            />
          </Field>
          <Field label="Numbers to review">
            <input
              value={form.numbersToReview}
              onChange={(e) => set("numbersToReview", e.target.value)}
            />
          </Field>
          <Field label="Questions to answer">
            <input
              value={form.questions}
              onChange={(e) => set("questions", e.target.value)}
            />
          </Field>
          <Field label="Action owner">
            <input
              value={form.actionOwner}
              onChange={(e) => set("actionOwner", e.target.value)}
            />
          </Field>
          <Field label="Deadline">
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => set("deadline", e.target.value)}
            />
          </Field>
          <button className="primary" onClick={add}>
            Save meeting
          </button>
        </div>
      )}

      {store.meetings.length === 0 ? (
        <p className="muted">No meetings yet.</p>
      ) : (
        <ul className="meeting-list">
          {store.meetings.map((m) => (
            <li key={m.id} className="meeting">
              <div className="meeting-head">
                <span className="strong grow">{m.title}</span>
                {m.when && <span className="muted small">{m.when}</span>}
                <button
                  className="icon-btn"
                  title="Delete"
                  onClick={async () => {
                    await api.del(`/meetings/${m.id}`);
                    await store.refresh();
                  }}
                >
                  ✕
                </button>
              </div>
              {m.warning && <div className="warn-banner">⚠ {m.warning}</div>}
              <dl className="meeting-grid">
                {m.goal && (
                  <>
                    <dt>Goal</dt>
                    <dd>{m.goal}</dd>
                  </>
                )}
                {m.decisionsRequired && (
                  <>
                    <dt>Decisions required</dt>
                    <dd>{m.decisionsRequired}</dd>
                  </>
                )}
                {m.numbersToReview && (
                  <>
                    <dt>Numbers</dt>
                    <dd>{m.numbersToReview}</dd>
                  </>
                )}
                {m.questions && (
                  <>
                    <dt>Questions</dt>
                    <dd>{m.questions}</dd>
                  </>
                )}
                {m.actionOwner && (
                  <>
                    <dt>Owner</dt>
                    <dd>{m.actionOwner}</dd>
                  </>
                )}
                {m.decisionMade && (
                  <>
                    <dt>Decision made</dt>
                    <dd className="green-text">{m.decisionMade}</dd>
                  </>
                )}
                {m.followUpDate && (
                  <>
                    <dt>Follow-up</dt>
                    <dd>{m.followUpDate}</dd>
                  </>
                )}
              </dl>
              {!m.decisionMade && (
                <button className="chip" onClick={() => recordOutcome(m)}>
                  Record outcome
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

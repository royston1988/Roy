import { useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import type { Delegation as Del, DelegationStatus } from "../types";
import { deadlineTone, isOverdue, Pill } from "../ui";

const STATUSES: DelegationStatus[] = ["in-progress", "waiting", "delayed", "done"];
const STATUS_LABEL: Record<DelegationStatus, string> = {
  "in-progress": "In progress",
  waiting: "Waiting",
  delayed: "Delayed",
  done: "Done",
};
const STATUS_TONE: Record<DelegationStatus, "blue" | "yellow" | "red" | "green"> = {
  "in-progress": "blue",
  waiting: "yellow",
  delayed: "red",
  done: "green",
};

export function Delegation() {
  const store = useStore();
  const empty = { matter: "", owner: "", expectedResult: "", deadline: "" };
  const [form, setForm] = useState(empty);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function add() {
    if (!form.matter.trim() || !form.owner.trim()) return;
    await api.post("/delegations", { ...form, deadline: form.deadline || undefined });
    setForm(empty);
    await store.refresh();
  }

  async function update(d: Del, patch: Partial<Del>) {
    await api.patch(`/delegations/${d.id}`, patch);
    await store.refresh();
  }

  async function remind(d: Del) {
    const res = await api.get<{ text: string }>(`/delegations/${d.id}/reminder`);
    // WhatsApp-style quick update: prefill a share/clipboard message.
    try {
      await navigator.clipboard.writeText(res.text);
      alert(`Reminder copied to clipboard:\n\n${res.text}`);
    } catch {
      alert(res.text);
    }
  }

  const active = store.delegations.filter((d) => d.status !== "done");
  const done = store.delegations.filter((d) => d.status === "done");

  return (
    <div className="page">
      <section className="card">
        <div className="card-head">
          <h2>Waiting for Others</h2>
        </div>
        <p className="muted small">
          Once you delegate something, it should leave your head. Roy flags anything
          overdue in red and gives you one-click reminder text to send the owner.
        </p>
        <div className="deleg-form">
          <input
            value={form.matter}
            onChange={(e) => set("matter", e.target.value)}
            placeholder="Matter"
          />
          <input
            value={form.owner}
            onChange={(e) => set("owner", e.target.value)}
            placeholder="Owner"
          />
          <input
            className="grow"
            value={form.expectedResult}
            onChange={(e) => set("expectedResult", e.target.value)}
            placeholder="Expected result"
          />
          <input
            type="date"
            value={form.deadline}
            onChange={(e) => set("deadline", e.target.value)}
          />
          <button className="primary" onClick={add}>
            Delegate
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Active ({active.length})</h2>
        </div>
        {active.length === 0 ? (
          <p className="muted">Nothing delegated right now.</p>
        ) : (
          <div className="table-scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Matter</th>
                  <th>Owner</th>
                  <th>Expected result</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {active.map((d) => (
                  <tr
                    key={d.id}
                    className={
                      d.status === "delayed" || isOverdue(d.deadline) ? "row-delayed" : ""
                    }
                  >
                    <td className="title-cell">{d.matter}</td>
                    <td>{d.owner}</td>
                    <td className="muted">{d.expectedResult || "—"}</td>
                    <td>
                      {d.deadline ? (
                        <Pill tone={deadlineTone(d.deadline)}>{d.deadline}</Pill>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <select
                        value={d.status}
                        onChange={(e) =>
                          update(d, { status: e.target.value as DelegationStatus })
                        }
                        className={`status-select tone-${STATUS_TONE[d.status]}`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="nowrap">
                      <button className="chip" onClick={() => remind(d)} title="Copy reminder">
                        Remind
                      </button>
                      <button
                        className="icon-btn"
                        title="Delete"
                        onClick={async () => {
                          await api.del(`/delegations/${d.id}`);
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
        )}
      </section>

      {done.length > 0 && (
        <section className="card compact">
          <h2>Completed ({done.length})</h2>
          <ul className="mini-list">
            {done.map((d) => (
              <li key={d.id}>
                <Pill tone="green">done</Pill>
                <span className="grow strike">{d.matter}</span>
                <span className="muted small">{d.owner}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

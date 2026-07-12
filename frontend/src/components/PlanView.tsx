import { useRef, useState } from "react";
import { streamPlan } from "../api";
import { todayISO } from "../util";

export default function PlanView() {
  const [request, setRequest] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function run(customRequest?: string) {
    if (busy) return;
    setError(null);
    setOutput("");
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    await streamPlan(
      { date: todayISO(), request: customRequest ?? request },
      {
        signal: controller.signal,
        onDelta: (d) => setOutput((o) => o + d),
        onDone: () => setBusy(false),
        onError: (m) => {
          setError(m);
          setBusy(false);
        },
      },
    );
  }

  return (
    <div className="stack">
      <div className="card">
        <h3 className="section-title">Ask Roy to plan</h3>
        <p className="muted small">
          Roy reads your open tasks and today's schedule to suggest priorities and a
          time-blocked plan.
        </p>
        <div className="quick-row">
          <button className="ghost" onClick={() => run("Plan my day.")} disabled={busy}>
            Plan my day
          </button>
          <button
            className="ghost"
            onClick={() => run("What are my top 3 priorities today and why?")}
            disabled={busy}
          >
            Top priorities
          </button>
          <button
            className="ghost"
            onClick={() =>
              run("I have 2 free hours this afternoon — what should I work on?")
            }
            disabled={busy}
          >
            Fill 2 free hours
          </button>
        </div>
        <div className="composer-row">
          <input
            className="grow"
            placeholder="Or ask something specific…"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
          />
          <button onClick={() => run()} disabled={busy}>
            {busy ? "…" : "Ask"}
          </button>
        </div>
      </div>

      {(output || busy || error) && (
        <div className="card">
          {error && <div className="error">⚠ {error}</div>}
          <div className="plan-output">
            {output || (busy ? <span className="muted">thinking…</span> : null)}
          </div>
        </div>
      )}
    </div>
  );
}

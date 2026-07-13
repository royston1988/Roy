import { useEffect, useState } from "react";
import { api } from "../api";
import { todayStr } from "../store";
import type { BlockType, DailyReview, TimeReport } from "../types";
import { BLOCK_LABEL, Field } from "../ui";

const QUESTIONS: { key: keyof DailyReview; label: string }[] = [
  { key: "importantResult", label: "What important result did I complete?" },
  { key: "timeOverrun", label: "What consumed more time than expected?" },
  { key: "toDelegate", label: "What should I delegate?" },
  { key: "unfinishedDecision", label: "What decision is still unfinished?" },
  { key: "tomorrowPriority", label: "What is tomorrow's number-one priority?" },
];

const TYPE_ORDER: BlockType[] = [
  "thinking",
  "decision",
  "meeting",
  "review",
  "people",
  "personal",
];

export function Review() {
  const date = todayStr();
  const [review, setReview] = useState<DailyReview>({ date });
  const [report, setReport] = useState<TimeReport | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void api.get<DailyReview>(`/reviews/${date}`).then(setReview);
    void api.get<TimeReport>("/report").then(setReport);
  }, [date]);

  function set<K extends keyof DailyReview>(k: K, v: string) {
    setReview((r) => ({ ...r, [k]: v }));
    setSaved(false);
  }

  async function save() {
    await api.put(`/reviews/${date}`, review);
    setSaved(true);
  }

  async function summarize() {
    await save();
    setSummarizing(true);
    try {
      const answers: Record<string, string> = {};
      for (const q of QUESTIONS) {
        const v = review[q.key];
        if (typeof v === "string" && v) answers[q.label] = v;
      }
      const res = await api.post<{ summary: string }>(`/ai/review/${date}`, answers);
      setReview((r) => ({ ...r, aiSummary: res.summary }));
    } catch (err) {
      setReview((r) => ({
        ...r,
        aiSummary: err instanceof Error ? err.message : "summary failed",
      }));
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <div className="page">
      <section className="card">
        <div className="card-head">
          <h2>End-of-day review</h2>
          {saved && <span className="muted small">saved ✓</span>}
        </div>
        <div className="review-questions">
          {QUESTIONS.map((q) => (
            <Field key={q.key} label={q.label}>
              <textarea
                rows={2}
                value={(review[q.key] as string) ?? ""}
                onChange={(e) => set(q.key, e.target.value)}
                onBlur={save}
              />
            </Field>
          ))}
        </div>
        <div className="row-actions">
          <button className="primary" onClick={summarize} disabled={summarizing}>
            {summarizing ? "Summarizing…" : "✨ Generate AI summary"}
          </button>
        </div>
        {review.aiSummary && <div className="ai-summary">{review.aiSummary}</div>}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Weekly CEO time report</h2>
          {report && (
            <span className="muted small">
              {report.from} → {report.to} · {report.totalHours}h
            </span>
          )}
        </div>
        {!report || report.totalHours === 0 ? (
          <p className="muted">
            No time blocks in the last 7 days yet. Add blocks in the Calendar to see where
            your time goes.
          </p>
        ) : (
          <>
            <h3 className="section-sub">Where your time went</h3>
            <div className="bars">
              {TYPE_ORDER.filter((t) => report.byTypePct[t] > 0).map((t) => (
                <div key={t} className="bar-row">
                  <span className="bar-label">{BLOCK_LABEL[t]}</span>
                  <div className="bar-track">
                    <div className={`bar-fill dot-${t}`} style={{ width: `${report.byTypePct[t]}%` }} />
                  </div>
                  <span className="bar-pct">{report.byTypePct[t]}%</span>
                </div>
              ))}
            </div>

            <h3 className="section-sub">Time quality</h3>
            <div className="quality">
              <QualityStat label="High-value CEO time" pct={report.quality.high} tone="green" />
              <QualityStat label="Delegatable work" pct={report.quality.delegatable} tone="yellow" />
              <QualityStat label="Low-value / personal" pct={report.quality.low} tone="blue" />
            </div>

            <h3 className="section-sub">Roy's recommendations</h3>
            <ul className="recs">
              {report.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function QualityStat({
  label,
  pct,
  tone,
}: {
  label: string;
  pct: number;
  tone: "green" | "yellow" | "blue";
}) {
  return (
    <div className={`qstat qstat-${tone}`}>
      <div className="qpct">{pct}%</div>
      <div className="qlabel">{label}</div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import type {
  BlockType,
  Impact,
  InboxClassification,
  Responsibility,
  TaskDecision,
  Urgency,
} from "./types";

export const IMPACT_LABEL: Record<Impact, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};
export const URGENCY_LABEL: Record<Urgency, string> = {
  today: "Today",
  week: "This week",
  later: "Later",
};
export const RESP_LABEL: Record<Responsibility, string> = {
  "only-roy": "Only Roy can do",
  "roy-decides": "Roy decides, team executes",
  team: "Team can handle",
  "should-not": "Should not be done",
};
export const TIME_LABEL: Record<number, string> = {
  15: "15 min",
  30: "30 min",
  60: "1 hour",
  120: "1 hour+",
};
export const DECISION_LABEL: Record<TaskDecision, string> = {
  "do-today": "Do today",
  schedule: "Schedule focus block",
  delegate: "Delegate",
  remove: "Remove from Roy",
};
export const CLASSIFY_LABEL: Record<InboxClassification, string> = {
  "do-now": "Do now",
  schedule: "Schedule",
  delegate: "Delegate",
  waiting: "Waiting for someone",
  remove: "Remove",
};
export const BLOCK_LABEL: Record<BlockType, string> = {
  thinking: "CEO Thinking",
  decision: "Decision",
  meeting: "Meeting",
  review: "Review",
  people: "People",
  personal: "Personal",
};

export function Pill({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "yellow" | "red" | "blue" | "purple";
  title?: string;
}) {
  return (
    <span className={`pill pill-${tone}`} title={title}>
      {children}
    </span>
  );
}

/** Red for overdue, yellow for due today, from a YYYY-MM-DD deadline (local time). */
export function deadlineTone(
  deadline?: string,
): "red" | "yellow" | "neutral" {
  if (!deadline) return "neutral";
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (deadline < today) return "red";
  if (deadline === today) return "yellow";
  return "neutral";
}

/** True when a dated item is past due (local calendar day). */
export function isOverdue(deadline?: string): boolean {
  return deadlineTone(deadline) === "red";
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

/** One-click voice input using the Web Speech API where available. */
export function useVoiceInput(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const SR =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition
      : undefined;
  const supported = Boolean(SR);

  useEffect(() => {
    return () => recRef.current?.stop();
  }, []);

  function toggle() {
    if (!supported) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec: SpeechRecognitionLike = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript ?? "";
      if (text) onText(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  return { supported, listening, toggle };
}

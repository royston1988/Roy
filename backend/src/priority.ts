// CEO priority scoring. Turns the four questions (impact, urgency,
// responsibility, time) into a numeric score and a recommended decision.
import type {
  Impact,
  Responsibility,
  Task,
  TaskDecision,
  Urgency,
} from "./types.js";

const IMPACT_SCORE: Record<Impact, number> = { high: 3, medium: 2, low: 1 };
const URGENCY_SCORE: Record<Urgency, number> = { today: 3, week: 2, later: 1 };
const RESP_LEVERAGE: Record<Responsibility, number> = {
  "only-roy": 3,
  "roy-decides": 3,
  team: 1,
  "should-not": 0,
};

/** 0–100 priority score. Higher = more deserving of Roy's attention now. */
export function scoreTask(task: Task): number {
  const impact = IMPACT_SCORE[task.impact];
  const urgency = URGENCY_SCORE[task.urgency];
  const leverage = RESP_LEVERAGE[task.responsibility];
  // Impact matters most, then how much only-Roy leverage it needs, then urgency.
  const raw = impact * 3 + leverage * 2 + urgency * 1.5;
  const max = 3 * 3 + 3 * 2 + 3 * 1.5; // 19.5
  return Math.round((raw / max) * 100);
}

/** The recommended decision for a task, following the CEO priority system. */
export function recommendDecision(task: Task): TaskDecision {
  if (task.responsibility === "should-not") return "remove";

  if (task.responsibility === "team") {
    // Low-impact team work isn't worth Roy tracking at all.
    return task.impact === "low" ? "remove" : "delegate";
  }

  // Only Roy can do it, or Roy must decide.
  const urgent = task.urgency === "today";
  const worthDoingNow = task.impact === "high" || task.impact === "medium";
  if (urgent && worthDoingNow) return "do-today";
  return "schedule";
}

export function decisionLabel(decision: TaskDecision): string {
  switch (decision) {
    case "do-today":
      return "Do today";
    case "schedule":
      return "Schedule focus block";
    case "delegate":
      return "Delegate";
    case "remove":
      return "Remove from Roy";
  }
}

export type ScoredTask = Task & {
  score: number;
  recommendation: TaskDecision;
  recommendationLabel: string;
};

export function enrich(task: Task): ScoredTask {
  const recommendation = recommendDecision(task);
  return {
    ...task,
    score: scoreTask(task),
    recommendation,
    recommendationLabel: decisionLabel(recommendation),
  };
}

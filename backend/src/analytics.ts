// Deterministic time analysis for the daily/weekly CEO time report.
import type { BlockType, Database } from "./types.js";

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

// How each block type maps onto "CEO time quality".
const QUALITY: Record<BlockType, "high" | "delegatable" | "low"> = {
  thinking: "high",
  decision: "high",
  people: "high",
  review: "delegatable",
  meeting: "delegatable",
  personal: "low",
};

export type TimeReport = {
  from: string;
  to: string;
  totalHours: number;
  byType: Record<BlockType, number>; // hours
  byTypePct: Record<BlockType, number>;
  quality: { high: number; delegatable: number; low: number }; // percentages
  recommendations: string[];
};

export function timeReport(db: Database, from: string, to: string): TimeReport {
  const blocks = db.blocks.filter((b) => b.date >= from && b.date <= to);

  const byType = {
    thinking: 0,
    decision: 0,
    meeting: 0,
    review: 0,
    people: 0,
    personal: 0,
  } as Record<BlockType, number>;

  const quality = { high: 0, delegatable: 0, low: 0 };

  for (const b of blocks) {
    const hrs = minutesBetween(b.start, b.end) / 60;
    byType[b.type] += hrs;
    quality[QUALITY[b.type]] += hrs;
  }

  const totalHours = Object.values(byType).reduce((a, b) => a + b, 0);
  const pct = (h: number) =>
    totalHours > 0 ? Math.round((h / totalHours) * 100) : 0;

  const byTypePct = Object.fromEntries(
    Object.entries(byType).map(([k, v]) => [k, pct(v)]),
  ) as Record<BlockType, number>;

  const recommendations: string[] = [];
  const opsHours = byType.meeting + byType.review;
  if (pct(byType.meeting) > 35) {
    recommendations.push(
      "Meetings exceed a third of your time — combine recurring reviews into one weekly performance meeting.",
    );
  }
  if (quality.delegatable / (totalHours || 1) > 0.3) {
    recommendations.push(
      `About ${pct(quality.delegatable)}% of your time is delegatable — hand off ${Math.max(2, Math.round(opsHours / 2))}+ hours next week.`,
    );
  }
  if (pct(byType.thinking) < 20) {
    recommendations.push(
      "Reserve two 90-minute CEO thinking blocks — strategy time is below 20%.",
    );
  }
  if (recommendations.length === 0 && totalHours > 0) {
    recommendations.push("Healthy balance — protect your thinking blocks next week.");
  }

  return {
    from,
    to,
    totalHours: Math.round(totalHours * 10) / 10,
    byType,
    byTypePct,
    quality: {
      high: pct(quality.high),
      delegatable: pct(quality.delegatable),
      low: pct(quality.low),
    },
    recommendations,
  };
}

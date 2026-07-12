export const todayISO = () => new Date().toISOString().slice(0, 10);

export const minToHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export const hhmmToMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const fmtDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

export const priorityLabel = (p: number) => (p === 1 ? "P1" : p === 2 ? "P2" : "P3");

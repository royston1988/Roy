// Local-date helpers. The app's notion of "today" must follow the server's
// local calendar day, never UTC — toISOString() would flip the day at 8am
// for a user in Malaysia (UTC+8).

/** YYYY-MM-DD in local time. */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local YYYY-MM-DD of an ISO timestamp (e.g. a completedAt). */
export function localDateOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : localDate(d);
}

export const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Normalize "9:00" → "09:00"; returns null if not a valid HH:MM. */
export function normalizeHM(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hm = `${m[1].padStart(2, "0")}:${m[2]}`;
  return HM_RE.test(hm) ? hm : null;
}

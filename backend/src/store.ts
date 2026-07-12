import { randomUUID } from "node:crypto";
import { db } from "./db.js";

const now = () => new Date().toISOString();

// ---------- Types ----------

export type Task = {
  id: string;
  title: string;
  notes: string;
  status: "todo" | "doing" | "done";
  priority: number;
  project: string;
  due_date: string | null;
  estimate_min: number | null;
  is_top3: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type Block = {
  id: string;
  task_id: string | null;
  title: string;
  date: string;
  start_min: number;
  end_min: number;
  created_at: string;
};

export type Session = {
  id: string;
  task_id: string | null;
  kind: "timer" | "pomodoro";
  started_at: string;
  ended_at: string;
  seconds: number;
};

// ---------- Tasks ----------

export function listTasks(filter?: { status?: string }): Task[] {
  if (filter?.status) {
    return db
      .prepare(
        "SELECT * FROM tasks WHERE status = ? ORDER BY is_top3 DESC, priority ASC, due_date IS NULL, due_date ASC, created_at ASC",
      )
      .all(filter.status) as Task[];
  }
  return db
    .prepare(
      "SELECT * FROM tasks ORDER BY status = 'done', is_top3 DESC, priority ASC, due_date IS NULL, due_date ASC, created_at ASC",
    )
    .all() as Task[];
}

export function getTask(id: string): Task | undefined {
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as
    | Task
    | undefined;
}

export function createTask(input: Partial<Task>): Task {
  const id = randomUUID();
  const ts = now();
  db.prepare(
    `INSERT INTO tasks (id, title, notes, status, priority, project, due_date, estimate_min, is_top3, created_at, updated_at)
     VALUES (@id, @title, @notes, @status, @priority, @project, @due_date, @estimate_min, @is_top3, @created_at, @updated_at)`,
  ).run({
    id,
    title: (input.title ?? "Untitled").trim(),
    notes: input.notes ?? "",
    status: input.status ?? "todo",
    priority: input.priority ?? 2,
    project: input.project ?? "",
    due_date: input.due_date ?? null,
    estimate_min: input.estimate_min ?? null,
    is_top3: input.is_top3 ? 1 : 0,
    created_at: ts,
    updated_at: ts,
  });
  return getTask(id)!;
}

export function updateTask(id: string, patch: Partial<Task>): Task | undefined {
  const existing = getTask(id);
  if (!existing) return undefined;

  const status = patch.status ?? existing.status;
  const completed_at =
    status === "done" ? existing.completed_at ?? now() : null;

  const next = {
    ...existing,
    ...patch,
    id,
    status,
    is_top3: patch.is_top3 === undefined ? existing.is_top3 : patch.is_top3 ? 1 : 0,
    completed_at,
    updated_at: now(),
  };

  db.prepare(
    `UPDATE tasks SET title=@title, notes=@notes, status=@status, priority=@priority,
       project=@project, due_date=@due_date, estimate_min=@estimate_min, is_top3=@is_top3,
       completed_at=@completed_at, updated_at=@updated_at
     WHERE id=@id`,
  ).run(next);
  return getTask(id)!;
}

export function deleteTask(id: string): boolean {
  return db.prepare("DELETE FROM tasks WHERE id = ?").run(id).changes > 0;
}

// ---------- Blocks (time-blocking) ----------

export function listBlocks(date: string): Block[] {
  return db
    .prepare("SELECT * FROM blocks WHERE date = ? ORDER BY start_min ASC")
    .all(date) as Block[];
}

export function createBlock(input: Partial<Block>): Block {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO blocks (id, task_id, title, date, start_min, end_min, created_at)
     VALUES (@id, @task_id, @title, @date, @start_min, @end_min, @created_at)`,
  ).run({
    id,
    task_id: input.task_id ?? null,
    title: (input.title ?? "Block").trim(),
    date: input.date!,
    start_min: input.start_min ?? 9 * 60,
    end_min: input.end_min ?? 10 * 60,
    created_at: now(),
  });
  return db.prepare("SELECT * FROM blocks WHERE id = ?").get(id) as Block;
}

export function updateBlock(id: string, patch: Partial<Block>): Block | undefined {
  const existing = db.prepare("SELECT * FROM blocks WHERE id = ?").get(id) as
    | Block
    | undefined;
  if (!existing) return undefined;
  const next = { ...existing, ...patch, id };
  db.prepare(
    `UPDATE blocks SET task_id=@task_id, title=@title, date=@date,
       start_min=@start_min, end_min=@end_min WHERE id=@id`,
  ).run(next);
  return db.prepare("SELECT * FROM blocks WHERE id = ?").get(id) as Block;
}

export function deleteBlock(id: string): boolean {
  return db.prepare("DELETE FROM blocks WHERE id = ?").run(id).changes > 0;
}

// ---------- Sessions (time tracking / pomodoro) ----------

export function createSession(input: Partial<Session>): Session {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO sessions (id, task_id, kind, started_at, ended_at, seconds)
     VALUES (@id, @task_id, @kind, @started_at, @ended_at, @seconds)`,
  ).run({
    id,
    task_id: input.task_id ?? null,
    kind: input.kind ?? "timer",
    started_at: input.started_at ?? now(),
    ended_at: input.ended_at ?? now(),
    seconds: input.seconds ?? 0,
  });
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Session;
}

// ---------- Stats / review ----------

export function statsSince(sinceISO: string) {
  const completed = db
    .prepare(
      "SELECT COUNT(*) AS n FROM tasks WHERE status='done' AND completed_at >= ?",
    )
    .get(sinceISO) as { n: number };

  const created = db
    .prepare("SELECT COUNT(*) AS n FROM tasks WHERE created_at >= ?")
    .get(sinceISO) as { n: number };

  const openByPriority = db
    .prepare(
      "SELECT priority, COUNT(*) AS n FROM tasks WHERE status != 'done' GROUP BY priority",
    )
    .all() as { priority: number; n: number }[];

  const focusSeconds = db
    .prepare(
      "SELECT COALESCE(SUM(seconds),0) AS s FROM sessions WHERE started_at >= ?",
    )
    .get(sinceISO) as { s: number };

  const byProject = db
    .prepare(
      `SELECT COALESCE(NULLIF(t.project,''),'(none)') AS project, COALESCE(SUM(s.seconds),0) AS seconds
       FROM sessions s LEFT JOIN tasks t ON t.id = s.task_id
       WHERE s.started_at >= ? GROUP BY project ORDER BY seconds DESC`,
    )
    .all(sinceISO) as { project: string; seconds: number }[];

  return {
    since: sinceISO,
    completed: completed.n,
    created: created.n,
    open_by_priority: openByPriority,
    focus_seconds: focusSeconds.s,
    focus_by_project: byProject,
  };
}

import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Store the database file next to the backend package so it survives restarts
// but stays out of source control (see .gitignore).
const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? join(__dirname, "..", "data.sqlite");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    notes        TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'todo',      -- todo | doing | done
    priority     INTEGER NOT NULL DEFAULT 2,        -- 1 (high) .. 3 (low)
    project      TEXT NOT NULL DEFAULT '',
    due_date     TEXT,                              -- YYYY-MM-DD or NULL
    estimate_min INTEGER,                           -- rough size in minutes
    is_top3      INTEGER NOT NULL DEFAULT 0,        -- focus flag for today
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS blocks (
    id           TEXT PRIMARY KEY,
    task_id      TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    title        TEXT NOT NULL,
    date         TEXT NOT NULL,                     -- YYYY-MM-DD
    start_min    INTEGER NOT NULL,                  -- minutes from midnight
    end_min      INTEGER NOT NULL,
    created_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT PRIMARY KEY,
    task_id      TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    kind         TEXT NOT NULL DEFAULT 'timer',     -- timer | pomodoro
    started_at   TEXT NOT NULL,
    ended_at     TEXT NOT NULL,
    seconds      INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status  ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_blocks_date   ON blocks(date);
  CREATE INDEX IF NOT EXISTS idx_sessions_task ON sessions(task_id);
`);

# Roy

A personal time-management system — React frontend + Node/TypeScript backend,
with an assistant powered by Claude that plans your day.

## Quick start

```bash
cp .env.example .env       # paste your ANTHROPIC_API_KEY
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:3001

## Features

- **Today** — capture tasks with priority, due date, estimate, and project;
  cycle them through todo → doing → done, and star your "Top 3 for today".
- **Schedule** — time-block your day on a visual timeline, from tasks or ad-hoc
  labels.
- **Plan** — ask Claude to read your open tasks and schedule and propose
  priorities and a realistic time-blocked plan.
- **Review** — weekly stats: completed vs. created, open work by priority, and
  focus time by project.
- **Chat** — a free-form conversation with Roy.
- A **Pomodoro / focus timer** is always available; completed focus sessions are
  logged and feed the Review stats.

## Layout

- `backend/` — Express + Anthropic SDK + SQLite (`better-sqlite3`)
  - `db.ts` — schema (tasks, blocks, sessions)
  - `store.ts` — data access + stats
  - `claude.ts` — streaming chat and day-planning
  - `index.ts` — REST + SSE routes
- `frontend/` — Vite + React
  - `components/` — TasksView, ScheduleView, PlanView, ReviewView, ChatView, Pomodoro

Data is stored locally in `backend/data.sqlite` (gitignored). Override the path
with the `DB_PATH` env var.

## API

| Method | Path                | Purpose                                  |
| ------ | ------------------- | ---------------------------------------- |
| GET    | `/api/tasks`        | List tasks (optional `?status=`)         |
| POST   | `/api/tasks`        | Create a task                            |
| PATCH  | `/api/tasks/:id`    | Update a task                            |
| DELETE | `/api/tasks/:id`    | Delete a task                            |
| GET    | `/api/blocks?date=` | List time-blocks for a day               |
| POST   | `/api/blocks`       | Create a time-block                      |
| DELETE | `/api/blocks/:id`   | Delete a time-block                      |
| POST   | `/api/sessions`     | Log a focus/Pomodoro session             |
| GET    | `/api/stats?days=`  | Aggregated review stats                  |
| POST   | `/api/plan`         | Stream a day plan (SSE)                  |
| POST   | `/api/chat`         | Stream chat (SSE)                        |

## Configuration

| Variable            | Default              | Notes                                |
| ------------------- | -------------------- | ------------------------------------ |
| `ANTHROPIC_API_KEY` | _(required)_         | Your Anthropic key                   |
| `ANTHROPIC_MODEL`   | `claude-sonnet-4-6`  | Override to try Opus or Haiku        |
| `PORT`              | `3001`               | Backend port                         |
| `DB_PATH`           | `backend/data.sqlite`| SQLite database file location        |

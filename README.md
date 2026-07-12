# Roy — a CEO attention-management system

Roy is a personal time-management web app for a CEO. It doesn't just record tasks —
it helps you decide **what to focus on now, what to delegate, and where your time is
being wasted.** The goal isn't another to-do list; it's managing your limited
attention, decisions and leadership time.

Built as a React frontend + Node/TypeScript backend, with an AI chief-of-staff
(powered by Claude) available on every page.

## Quick start

```bash
cp .env.example .env       # paste your ANTHROPIC_API_KEY (optional)
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:3001

The app works without an API key — AI features (inbox classification, the daily
planner, and the end-of-day summary) fall back to deterministic heuristics, and the
chief-of-staff chat is disabled until a key is set.

## The six-page workflow

**Capture → Prioritize → Schedule → Focus → Delegate → Review**

1. **Today** — your main goal, top 3 priorities, today's schedule, and a one-click
   *Start Focus Session* timer.
2. **Inbox** — capture anything on your mind in one line (voice input supported). The
   AI classifies each item: do now · schedule · delegate · waiting · remove.
3. **Priorities** — the CEO Priority System. Score any task with four questions
   (impact, urgency, responsibility, time needed); Roy computes a priority score and
   recommends whether to do it today, schedule it, delegate it, or drop it.
4. **Calendar** — time-block your day by type (CEO Thinking, Decision, Meeting,
   Review, People, Personal) and see whether you're spending enough time *as a CEO*
   vs. on operational work. Includes the AI daily planner.
5. **Decisions** — matters waiting for your approval, plus a meeting manager that
   warns you when a meeting has no clear decision to make.
6. **Delegation** — *Waiting for Others*: owner, expected result, deadline and status
   for everything you've handed off, with one-click reminder text.
7. **Review** — a five-question end-of-day review with an AI summary, and a weekly CEO
   time report showing where your time went, its quality, and what to change.

## Layout

- `backend/` — Express + Anthropic SDK. REST API for tasks, inbox, blocks, decisions,
  delegations, meetings and reviews; AI endpoints for classify / plan / review; and
  `POST /api/chat` as a Server-Sent Events stream for the assistant. Data persists to
  a local JSON file (`backend/data/roy.json`) — no database to set up.
- `frontend/` — Vite + React app with the seven pages above and the AI assistant.

## Configuration

Environment variables (loaded by the backend from `.env`):

| Variable            | Default              | Notes                                     |
| ------------------- | -------------------- | ----------------------------------------- |
| `ANTHROPIC_API_KEY` | _(optional)_         | Enables AI features; app works without it |
| `ANTHROPIC_MODEL`   | `claude-sonnet-4-6`  | Override to try Opus or Haiku             |
| `PORT`              | `3001`               | Backend port                              |

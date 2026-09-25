# Jarvis

A developer coding assistant — React frontend + Node/TypeScript backend, powered by Claude with streaming responses.

## Quick start

```bash
cp .env.example .env       # paste your ANTHROPIC_API_KEY
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:3001

## Layout

- `backend/` — Express + Anthropic SDK, exposes `POST /api/chat` as Server-Sent Events
- `frontend/` — Vite + React chat UI that consumes the SSE stream

## Auto model picking

The **AI model** menu in the top-right defaults to **Auto**. Before each answer,
Haiku reads your message and picks the model for the job:

| Pick         | Model      | Used for                                                    |
| ------------ | ---------- | ----------------------------------------------------------- |
| ⚡ Quick     | Haiku 4.5  | greetings, simple facts, short rewrites, one-line fixes     |
| ◆ Standard   | Sonnet 5   | everyday coding help, clear bugs, how-to questions          |
| 🧠 Deep      | Opus 5     | tricky bugs, design and architecture, big refactors, audits |

Each reply shows which model answered. Pick Quick, Standard or Deep in the menu to
force one. If the picker call fails, a simple built-in rule decides instead.

## Configuration

Environment variables (loaded by the backend from `.env`):

| Variable            | Default              | Notes                                |
| ------------------- | -------------------- | ------------------------------------ |
| `ANTHROPIC_API_KEY` | _(required)_         | Your Anthropic key                   |
| `MODEL_QUICK`       | `claude-haiku-4-5`   | Easy messages (and the auto-picker)  |
| `MODEL_STANDARD`    | `claude-sonnet-5`    | Everyday coding help                 |
| `MODEL_DEEP`        | `claude-opus-5`      | Hard problems                        |
| `PORT`              | `3001`               | Backend port                         |

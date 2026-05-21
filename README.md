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

## Configuration

Environment variables (loaded by the backend from `.env`):

| Variable            | Default              | Notes                                |
| ------------------- | -------------------- | ------------------------------------ |
| `ANTHROPIC_API_KEY` | _(required)_         | Your Anthropic key                   |
| `ANTHROPIC_MODEL`   | `claude-sonnet-4-6`  | Override to try Opus or Haiku        |
| `PORT`              | `3001`               | Backend port                         |

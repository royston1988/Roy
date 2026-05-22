# CLAUDE.md

Guidance for AI assistants (Claude Code and similar) working in this repo.

## What this project is

**Jarvis** — a small developer coding assistant.

- `backend/` — Node + TypeScript + Express. Wraps the Anthropic SDK and exposes
  `POST /api/chat` as a Server-Sent Events stream.
- `frontend/` — Vite + React chat UI that consumes the SSE stream via `fetch`
  + `ReadableStream` (not `EventSource`, because the endpoint is POST).

The repo is an npm workspaces monorepo. Top-level `package.json` orchestrates
both packages with `concurrently`.

## Layout

```
.
├── backend/
│   ├── src/
│   │   ├── index.ts     # Express app, /api/health, /api/chat SSE endpoint
│   │   └── claude.ts    # Anthropic SDK wrapper, streamChat() async generator
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx     # React entry
│   │   ├── App.tsx      # Chat UI: message list, composer, streaming state
│   │   ├── api.ts       # streamChat() — POSTs and parses SSE frames
│   │   └── styles.css
│   ├── index.html
│   ├── vite.config.ts   # dev proxy: /api -> http://localhost:3001
│   └── tsconfig.json
├── package.json         # workspaces: backend, frontend
├── .env.example
└── README.md
```

## Development workflows

All commands run from the repo root unless noted.

| Command              | What it does                                                   |
| -------------------- | -------------------------------------------------------------- |
| `npm install`        | Installs both workspaces                                       |
| `npm run dev`        | Runs backend (`tsx watch`) and frontend (`vite`) concurrently  |
| `npm run dev:backend`  | Backend only — http://localhost:3001                         |
| `npm run dev:frontend` | Frontend only — http://localhost:5173                        |
| `npm run build`      | `tsc` build for backend, then `vite build` for frontend        |
| `npm run typecheck`  | `tsc --noEmit` on both workspaces                              |

There is no test runner, lint config, or formatter set up. Don't fabricate
references to scripts that don't exist.

Before reporting work done, run `npm run typecheck` at minimum. For UI changes,
start `npm run dev` and exercise the feature in the browser.

## Environment

Backend loads `.env` via `dotenv/config` (see `backend/src/index.ts:1`).

| Var                 | Default              | Notes                              |
| ------------------- | -------------------- | ---------------------------------- |
| `ANTHROPIC_API_KEY` | _required_           | Backend will start without it but `/api/chat` will fail |
| `ANTHROPIC_MODEL`   | `claude-sonnet-4-6`  | Set in two places — see below      |
| `PORT`              | `3001`               | Backend port                       |

`ANTHROPIC_MODEL` has a default fallback in both `backend/src/claude.ts:5` and
the `/api/health` route at `backend/src/index.ts:11`. Keep them in sync when
updating the default.

## Key conventions

### TypeScript / module system

- Both packages are `"type": "module"` (ESM) with `"strict": true`.
- Backend `tsconfig` uses `moduleResolution: "Bundler"` + `module: "ESNext"`;
  it runs via `tsx` in dev and `tsc` for build. **Imports of local `.ts`
  files must use the `.js` extension** (e.g.
  `import { streamChat } from "./claude.js"` in `backend/src/index.ts:4`).
  This is required for the emitted output to resolve correctly under ESM.
- Frontend `tsconfig` has `noUnusedLocals` and `noUnusedParameters` enabled
  — dead identifiers will fail typecheck/build.

### Streaming protocol (backend ↔ frontend contract)

`POST /api/chat` accepts `{ messages: ChatMessage[] }` and responds with
`text/event-stream`. Three event types:

| `event:` | `data:` payload      | Meaning                          |
| -------- | -------------------- | -------------------------------- |
| `delta`  | `{ text: string }`   | One text chunk to append         |
| `done`   | `{}`                 | Stream finished cleanly          |
| `error`  | `{ message: string }`| Backend hit an error mid-stream  |

`ChatMessage` is `{ role: "user" | "assistant", content: string }` — defined
identically in `backend/src/claude.ts:15` and `frontend/src/api.ts:1`. The two
definitions are not shared via a package; if you change one, change the other.

Frontend parses frames manually in `frontend/src/api.ts` — it splits on `\n\n`
and reads `event:` / `data:` lines. If you add a new SSE event type on the
backend, also handle it in `parseFrame` / the read loop.

### Anthropic SDK usage

- The system prompt is sent with `cache_control: { type: "ephemeral" }` (see
  `backend/src/claude.ts:24`) to take advantage of prompt caching. Preserve
  this when modifying the system prompt; long-lived static prefixes belong in
  the cached block.
- `streamChat` is an async generator that yields only `text_delta` payloads.
  If you need tool use, thinking blocks, or other content block types, add
  handling for the corresponding `content_block_delta` variants.
- Default model is `claude-sonnet-4-6`. When updating to a newer model, also
  bump `@anthropic-ai/sdk` if needed and update both default-fallback sites.

### Frontend chat state

- `App.tsx` appends a blank assistant message before streaming begins
  (`App.tsx:24-29`) and mutates its `content` as deltas arrive. The "thinking…"
  placeholder is rendered while that last assistant message is still empty.
- Send-disable / Enter-to-send behavior lives in `App.tsx:56-61`; preserve
  Shift+Enter for newline.

## Conventions for AI edits

- Keep changes minimal and targeted. This is a small codebase; resist adding
  abstractions, lint configs, test scaffolding, or new dependencies unless
  asked.
- Don't add comments that just restate what the code does. The existing files
  have effectively no comments — match that style.
- Don't introduce a shared types package for `ChatMessage` unless the user
  asks; duplicating the two-field type across two files is fine here.
- The frontend dev server proxies `/api` to the backend on port 3001. Don't
  hardcode `http://localhost:3001` in frontend code — use relative `/api/...`
  paths.
- `.env` is gitignored. Never commit it. `.env.example` is the template.

## Git workflow

- Default branch is the one indicated by the active session; do not push to
  `main`/`master` without explicit instruction.
- Branch names from automated sessions look like `claude/<topic>-<id>`.
- Commit messages in this repo are short, imperative, and describe the
  change (see `git log`).

// Tiny JSON-file persistence. No database to set up — Roy's data lives in
// backend/data/roy.json and is loaded into memory, written back on each change.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "..", "data");
const DATA_FILE = resolve(DATA_DIR, "roy.json");

const EMPTY: Database = {
  tasks: [],
  inbox: [],
  blocks: [],
  decisions: [],
  delegations: [],
  meetings: [],
  reviews: [],
  days: [],
};

let db: Database = load();

function load(): Database {
  try {
    if (!existsSync(DATA_FILE)) return structuredClone(EMPTY);
    const raw = readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<Database>;
    return { ...structuredClone(EMPTY), ...parsed };
  } catch (err) {
    console.error("[roy] failed to load data, starting fresh:", err);
    return structuredClone(EMPTY);
  }
}

function persist() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.error("[roy] failed to persist data:", err);
  }
}

export function getDb(): Database {
  return db;
}

/** Mutate the database via a callback, then persist and return the result. */
export function mutate<T>(fn: (db: Database) => T): T {
  const result = fn(db);
  persist();
  return result;
}

export function id(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

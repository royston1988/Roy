import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// One .env at the repo root is shared with Jarvis; studio/.env can override.
dotenv.config({ path: path.join(ROOT, ".env") });
dotenv.config({ path: path.join(ROOT, "..", ".env") });

export const DATA_DIR = path.join(ROOT, "data");
export const IMAGES_DIR = path.join(DATA_DIR, "images");
export const FACES_DIR = path.join(ROOT, "faces");
fs.mkdirSync(IMAGES_DIR, { recursive: true });
for (const person of ["yan", "host"]) fs.mkdirSync(path.join(FACES_DIR, person), { recursive: true });

export const config = {
  port: Number(process.env.STUDIO_PORT || 3002),
  brand: process.env.STUDIO_BRAND || "our fashion boutique",
  aspectRatio: process.env.STUDIO_ASPECT_RATIO || "3:4",
  // 1K keeps photos small enough for Claude's design check (5 MB limit).
  imageSize: process.env.STUDIO_IMAGE_SIZE || "1K",
  shoplineToken: process.env.SHOPLINE_ACCESS_TOKEN || "",
  shoplineApi: process.env.SHOPLINE_API_URL || "https://open.shopline.io/v1",
  geminiKey: process.env.GEMINI_API_KEY || "",
  geminiApi: process.env.GEMINI_API_URL || "https://generativelanguage.googleapis.com/v1beta",
  geminiModel: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
  claudeKey: process.env.ANTHROPIC_API_KEY || "",
  claudeModel: process.env.STUDIO_CLAUDE_MODEL || "claude-opus-5",
};

// Each part runs for real once its key is set; until then it runs a free demo.
export const live = {
  shopline: Boolean(config.shoplineToken),
  photos: Boolean(config.geminiKey),
  claude: Boolean(config.claudeKey),
};

// Friendly name and approximate US$ per 1K photo, shown on the page.
const PHOTO_MODELS: Record<string, { name: string; price: number }> = {
  "gemini-3.1-flash-image": { name: "Nano Banana 2", price: 0.067 },
  "gemini-3.1-flash-image-preview": { name: "Nano Banana 2", price: 0.067 },
  "gemini-3-pro-image-preview": { name: "Nano Banana Pro", price: 0.134 },
};
export const photoModel = PHOTO_MODELS[config.geminiModel] ?? { name: config.geminiModel, price: 0.1 };

export const PEOPLE = { yan: "Yan", host: "Live host" } as const;
export type Person = keyof typeof PEOPLE;

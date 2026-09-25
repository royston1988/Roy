import fs from "node:fs";
import path from "node:path";
import { FACES_DIR, IMAGES_DIR, type Person } from "./config.js";

export type Img = { data: Buffer; mime: string };

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

// CDNs often send "application/octet-stream", so trust the file's first bytes.
export function sniffMime(data: Buffer, fallback = "image/jpeg"): string {
  if (data[0] === 0xff && data[1] === 0xd8) return "image/jpeg";
  if (data.subarray(0, 4).toString("hex") === "89504e47") return "image/png";
  if (data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (data.subarray(0, 3).toString() === "GIF") return "image/gif";
  if (data.subarray(0, 256).toString().includes("<svg")) return "image/svg+xml";
  return fallback;
}

export async function download(url: string): Promise<Img> {
  if (url.startsWith("/images/")) return readImage(path.basename(url));
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Couldn't download the product photo (${res.status}).`);
  const data = Buffer.from(await res.arrayBuffer());
  return { data, mime: sniffMime(data) };
}

export function saveImage(name: string, img: Img): string {
  const file = `${name}.${EXT[img.mime] ?? "img"}`;
  fs.writeFileSync(path.join(IMAGES_DIR, file), img.data);
  return file;
}

export function readImage(file: string): Img {
  const data = fs.readFileSync(path.join(IMAGES_DIR, file));
  return { data, mime: sniffMime(data) };
}

const FACE_FILE = /\.(jpe?g|png|webp)$/i;
const MAX_FACES = 5;

export function faceFiles(person: Person): string[] {
  const dir = path.join(FACES_DIR, person);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => FACE_FILE.test(f))
    .sort()
    .slice(0, MAX_FACES)
    .map((f) => path.join(dir, f));
}

export function loadFaces(person: Person): Img[] {
  return faceFiles(person).map((file) => {
    const data = fs.readFileSync(file);
    return { data, mime: sniffMime(data) };
  });
}

import fs from "node:fs";
import path from "node:path";
import { IMAGES_DIR, PEOPLE, type Person } from "./config.js";
import type { Brief, Check } from "./director.js";
import type { Img } from "./images.js";
import type { Product } from "./shopline.js";

// Free stand-ins so the whole flow can be tried before any keys are added.

const DEMO_ITEMS = [
  { id: "demo-1", title: "Demo: Emerald Satin Wrap Dress", color: "#1f7a5a" },
  { id: "demo-2", title: "Demo: Blush Lace Midi Dress", color: "#e8a3a8" },
  { id: "demo-3", title: "Demo: Navy Pleated Kurung", color: "#23345c" },
];

function dressSvg(color: string, label: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
  <rect width="600" height="800" fill="#f4f1ec"/>
  <path d="M250 120 h100 l30 80 l-20 20 l60 460 h-280 l60 -460 l-20 -20 z" fill="${color}"/>
  <text x="300" y="760" font-family="sans-serif" font-size="26" text-anchor="middle" fill="#555">${label}</text>
</svg>`;
}

export const demoProducts: Product[] = DEMO_ITEMS.map((item) => {
  const file = `${item.id}.svg`;
  const filePath = path.join(IMAGES_DIR, file);
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, dressSvg(item.color, "demo product photo"));
  return { id: item.id, title: item.title, imageUrl: `/images/${file}`, mediaIds: ["m1"], photoCount: 1 };
});

export function demoBriefs(people: Person[]): Brief[] {
  const pick = (i: number) => people[i % people.length] ?? "yan";
  return [
    { name: "Clean studio", person: pick(0), styling: "nude heels, pearl studs", scene: "warm grey seamless studio", pose: "standing, hand on hip", lighting: "large softbox", camera: "85mm, full body" },
    { name: "Outdoor lifestyle", person: pick(1), styling: "tan tote, gold bangle", scene: "sunny café street", pose: "walking, looking aside", lighting: "golden hour", camera: "50mm, full body" },
    { name: "Luxury editorial", person: pick(2), styling: "clutch, drop earrings", scene: "marble hotel lobby", pose: "seated on velvet chair", lighting: "soft window light", camera: "35mm, three-quarter" },
  ];
}

export function demoPhoto(brief: Brief): Img {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9d2c5"/><stop offset="1" stop-color="#9aa7b0"/></linearGradient></defs>
  <rect width="600" height="800" fill="url(#g)"/>
  <circle cx="300" cy="170" r="55" fill="#e9cbb1"/>
  <path d="M250 240 h100 l30 80 l-20 20 l60 400 h-280 l60 -400 l-20 -20 z" fill="#555" opacity="0.5"/>
  <text x="300" y="60" font-family="sans-serif" font-size="30" text-anchor="middle" fill="#222">DEMO PHOTO</text>
  <text x="300" y="770" font-family="sans-serif" font-size="24" text-anchor="middle" fill="#222">${brief.name} · ${PEOPLE[brief.person]}</text>
</svg>`;
  return { data: Buffer.from(svg), mime: "image/svg+xml" };
}

export const demoCheck: Check = {
  score: 96,
  verdict: "pass",
  differences: [],
  realism: ["Demo check. Add your Claude key to get real checks."],
};

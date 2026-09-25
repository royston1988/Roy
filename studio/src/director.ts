import Anthropic from "@anthropic-ai/sdk";
import { config, live, PEOPLE, type Person } from "./config.js";
import { demoBriefs, demoCheck } from "./demo.js";
import type { Img } from "./images.js";

export type Brief = {
  name: string;
  person: Person;
  styling: string;
  scene: string;
  pose: string;
  lighting: string;
  camera: string;
};

export type Plan = { productDetails: string; looks: Brief[] };

export type Check = {
  score: number;
  verdict: "pass" | "check" | "fail";
  differences: string[];
  realism: string[];
};

let client: Anthropic | null = null;

async function ask(images: { label: string; img: Img }[], prompt: string) {
  client ??= new Anthropic({ apiKey: config.claudeKey });

  const content: Anthropic.ContentBlockParam[] = [];
  for (const { label, img } of images) {
    content.push({ type: "text", text: label });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        data: img.data.toString("base64"),
      },
    });
  }
  content.push({ type: "text", text: prompt });

  const response = await client.messages.create({
    model: config.claudeModel,
    max_tokens: 16000,
    messages: [{ role: "user", content }],
  });
  // Newer models can decline (safety check); this SDK version doesn't list "refusal" yet.
  if ((response.stop_reason as string) === "refusal") {
    throw new Error("Claude declined to look at this photo.");
  }

  const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!json) throw new Error(`Claude's reply wasn't readable: ${text.slice(0, 200)}`);
  return JSON.parse(json);
}

// Claude's image limit is 5 MB of base64 per image.
const MAX_IMAGE_BYTES = Math.floor((5 * 1024 * 1024 * 3) / 4);
const claudeCanRead = (img: Img) => img.mime !== "image/svg+xml" && img.data.length <= MAX_IMAGE_BYTES;

export async function planLooks(product: Img, title: string, people: Person[]): Promise<Plan> {
  if (!live.claude || !claudeCanRead(product)) {
    return { productDetails: title, looks: demoBriefs(people) };
  }

  const models = people.map((p) => `"${p}" (${PEOPLE[p]})`).join(", ");
  const plan: Plan = await ask(
    [{ label: "PRODUCT PHOTO:", img: product }],
    `You are the art director for ${config.brand}, planning realistic e-commerce photos.

Product name: ${title}
Models available: ${models}

1. Describe the product exactly as it is, so a photographer can reproduce it without changes: garment type, colors, fabric and sheen, pattern or print and where it sits, neckline, sleeves, length, fit, closures, trims, embroidery, logos or text.
2. Plan 3 different looks: one clean luxury studio shot, one outdoor lifestyle shot, one editorial shot in an upscale location. For each, mix and match complementary pieces (shoes, bag, jewelry, outerwear or bottoms) that make the product look its best without covering or changing it. Spread the looks across the available models.

Never change the product itself. Reply with only this JSON:
{"productDetails": "...", "looks": [{"name": "Clean studio", "person": "yan", "styling": "...", "scene": "...", "pose": "...", "lighting": "...", "camera": "..."}]}`,
  );

  const looks = (plan.looks ?? []).slice(0, 3).map((look, i) => ({
    ...look,
    person: people.includes(look.person) ? look.person : people[i % people.length],
  }));
  if (looks.length === 0) throw new Error("Claude didn't plan any looks.");
  return { productDetails: plan.productDetails ?? title, looks };
}

export async function checkPhoto(original: Img, generated: Img): Promise<Check> {
  if (!live.claude || original.mime === "image/svg+xml" || generated.mime === "image/svg+xml") {
    return demoCheck;
  }
  if (!claudeCanRead(original) || !claudeCanRead(generated)) {
    return { score: 0, verdict: "check", differences: ["Photo too large for the automatic check. Please compare by eye."], realism: [] };
  }

  const check: Check = await ask(
    [
      { label: "ORIGINAL product photo (the real item we sell):", img: original },
      { label: "NEW AI photo:", img: generated },
    ],
    `Compare only the product being sold. Ignore the model, background, pose and added styling pieces.

List every difference in the product between the two photos: color, pattern or print (and its placement), cut, length, neckline, sleeves, fabric texture, trims, buttons, embroidery, logos or text. Be strict. A customer must receive exactly what the new photo shows.

Also list anything that makes the new photo look fake: hands, face, skin, fabric folds, lighting.

Score 100 means the product is identical. Verdict "pass" = safe to publish, "check" = small doubts, "fail" = the product is different.
Reply with only this JSON:
{"score": 0, "verdict": "pass", "differences": ["..."], "realism": ["..."]}`,
  );
  return {
    score: Number(check.score) || 0,
    verdict: ["pass", "check", "fail"].includes(check.verdict) ? check.verdict : "check",
    differences: check.differences ?? [],
    realism: check.realism ?? [],
  };
}

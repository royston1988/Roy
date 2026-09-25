import { config, live, PEOPLE } from "./config.js";
import { demoPhoto } from "./demo.js";
import type { Brief } from "./director.js";
import { sniffMime, type Img } from "./images.js";

// Google Gemini image model (Nano Banana 2 by default), called over plain HTTPS.

const inline = (img: Img) => ({ inlineData: { mimeType: img.mime, data: img.data.toString("base64") } });

// Google accepts at most 20 MB of inline photos per request; keep headroom.
const MAX_INLINE_BYTES = 14 * 1024 * 1024;
const base64Size = (img: Img) => Math.ceil(img.data.length / 3) * 4;

function fitFaces(product: Img, faces: Img[], who: string): Img[] {
  let total = base64Size(product);
  const kept = faces.filter((face) => (total += base64Size(face)) <= MAX_INLINE_BYTES);
  if (kept.length === 0) {
    throw new Error(`The photos of ${who} are too big. Use smaller photos (under 3 MB each).`);
  }
  return kept;
}

type GeminiPart = { text?: string; inlineData?: { mimeType?: string; data?: string } };

export async function makePhoto(opts: {
  brief: Brief;
  productDetails: string;
  product: Img;
  faces: Img[];
  note?: string;
}): Promise<Img> {
  const { brief, productDetails, product, faces, note } = opts;
  if (!live.photos) return demoPhoto(brief);
  if (faces.length === 0) {
    throw new Error(`No photos of ${PEOPLE[brief.person]} yet. Add some to studio/faces/${brief.person}/.`);
  }

  const prompt = `Create a photorealistic fashion e-commerce photo.

THE PRODUCT (most important): the model wears the exact item shown in the PRODUCT photo. Reproduce it exactly: same cut, length, neckline, sleeves, fabric and sheen, color, pattern or print and its placement, trims, buttons, embroidery, logos and text. Do not redesign, recolor, simplify, crop or add anything to it. If someone else wears it in the product photo, replace that person.
Product details: ${productDetails}

THE MODEL: the person in the MODEL photos (${PEOPLE[brief.person]}). Keep their face, skin tone, hair and body shape true to life and clearly recognizable.

STYLING: ${brief.styling}. These pieces must not cover or change the product.
SCENE: ${brief.scene}
POSE: ${brief.pose}
LIGHTING: ${brief.lighting}
CAMERA: ${brief.camera}
${note ? `\nEXTRA INSTRUCTIONS FROM THE SHOP OWNER: ${note}\n` : ""}
It must look like a real photo from a professional camera: natural skin texture, real fabric folds, accurate shadows, correct hands. The whole product is visible. No text, watermark, border or logo overlay.`;

  const parts: GeminiPart[] = [
    { text: prompt },
    { text: "PRODUCT photo:" },
    inline(product),
    { text: `MODEL photos (${PEOPLE[brief.person]}):` },
    ...fitFaces(product, faces, PEOPLE[brief.person]).map(inline),
  ];

  const res = await fetch(
    `${config.geminiApi}/models/${config.geminiModel}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.geminiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio: config.aspectRatio, imageSize: config.imageSize },
        },
      }),
      signal: AbortSignal.timeout(300_000),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Google photo maker said no (${res.status}): ${body.error?.message ?? "no details"}`);
  }

  const candidate = body.candidates?.[0];
  const image = (candidate?.content?.parts as GeminiPart[] | undefined)?.find((p) => p.inlineData?.data);
  if (!image?.inlineData?.data) {
    const reason = candidate?.finishReason ?? body.promptFeedback?.blockReason ?? "no reason given";
    throw new Error(`Google didn't return a photo (${reason}). Try Redo.`);
  }
  const data = Buffer.from(image.inlineData.data, "base64");
  return { data, mime: sniffMime(data, image.inlineData.mimeType) };
}

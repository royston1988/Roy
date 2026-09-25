import { config, live } from "./config.js";
import { demoProducts } from "./demo.js";
import type { Img } from "./images.js";

// Older SHOPLINE admin (admin.shoplineapp.com) Open API:
// https://open-api.docs.shoplineapp.com/docs/getting-started

export type Product = {
  id: string;
  title: string;
  imageUrl: string | null;
  mediaIds: string[];
  photoCount: number;
};

const PAGE_SIZE = 24;

async function api(pathname: string, init: RequestInit = {}) {
  const res = await fetch(`${config.shoplineApi}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.shoplineToken}`,
      Accept: "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Shopline said no (${res.status}): ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

type RawMedia = {
  _id?: string;
  id?: string;
  images?: Record<string, { url?: string } | undefined>;
};

type RawProduct = {
  _id?: string;
  id?: string;
  title?: string;
  title_translations?: Record<string, string>;
  medias?: RawMedia[];
};

function toProduct(raw: RawProduct): Product {
  const medias = raw.medias ?? [];
  const titles = raw.title_translations ?? {};
  const images = medias[0]?.images;
  return {
    id: String(raw.id ?? raw._id),
    title: titles.en ?? Object.values(titles)[0] ?? raw.title ?? "(no name)",
    imageUrl: images?.original?.url ?? images?.source?.url ?? null,
    mediaIds: medias.map((m) => m._id ?? m.id).filter((id): id is string => Boolean(id)),
    photoCount: medias.length,
  };
}

export async function listProducts(page: number) {
  if (!live.shopline) return { products: demoProducts, hasMore: false };

  const body = await api(`/products?page=${page}&per_page=${PAGE_SIZE}`);
  const items: RawProduct[] = body.items ?? body.data?.items ?? [];
  const totalPages: number | undefined = body.pagination?.total_pages;
  return {
    products: items.map(toProduct),
    hasMore: totalPages ? page < totalPages : items.length === PAGE_SIZE,
  };
}

export async function getProduct(id: string): Promise<Product> {
  if (!live.shopline) {
    const product = demoProducts.find((p) => p.id === id);
    if (!product) throw new Error(`No demo product ${id}`);
    return product;
  }
  const body = await api(`/products/${id}`);
  return toProduct(body.data ?? body);
}

// Adds the photo to the END of the product's gallery. Existing photos are kept.
export async function addPhoto(productId: string, img: Img, filename: string) {
  if (!live.shopline) throw new Error("Shopline isn't connected yet (demo mode).");

  const before = await getProduct(productId);
  if (before.mediaIds.length !== before.photoCount) {
    throw new Error(
      "Couldn't read this product's current photo list, so nothing was changed (to keep your photos safe).",
    );
  }

  const form = new FormData();
  form.append("data", new Blob([new Uint8Array(img.data)], { type: img.mime }), filename);
  const uploaded = await api("/media", { method: "POST", body: form });
  const media = uploaded.data ?? uploaded;
  const mediaId: string | undefined = media._id ?? media.id;
  if (!mediaId) throw new Error("Shopline took the photo but didn't say where it went.");

  // The docs don't pin down the body shape, so try both and check the result.
  const media_ids = [...before.mediaIds, mediaId];
  for (const body of [{ media_ids }, { product: { media_ids } }]) {
    await api(`/products/${productId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const after = await getProduct(productId);
    if (after.mediaIds.includes(mediaId)) return mediaId;
  }
  throw new Error("The photo uploaded, but Shopline didn't add it to the product.");
}

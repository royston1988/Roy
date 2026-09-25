// Standalone connector for the older SHOPLINE admin (admin.shoplineapp.com) Open API.
// It needs no other project files, so it can be copied into any Node 18+ TypeScript app.
// Docs: https://open-api.docs.shoplineapp.com/docs/getting-started

export type ShoplineProduct = {
  id: string;
  title: string;
  imageUrl: string | null;
  mediaIds: string[];
  photoCount: number;
};

export type ShoplinePhoto = { data: Uint8Array; mime: string };

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

function toProduct(raw: RawProduct): ShoplineProduct {
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

export function createShopline(opts: { token: string; apiUrl?: string }) {
  const base = opts.apiUrl ?? "https://open.shopline.io/v1";

  async function api(pathname: string, init: RequestInit = {}) {
    const res = await fetch(`${base}${pathname}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${opts.token}`,
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

  async function listPage(page: number, perPage: number) {
    const body = await api(`/products?page=${page}&per_page=${perPage}`);
    const items: RawProduct[] = body.items ?? body.data?.items ?? [];
    const totalPages: number | undefined = body.pagination?.total_pages;
    return { items, hasMore: totalPages ? page < totalPages : items.length === perPage };
  }

  async function listProducts(page = 1, perPage = 24) {
    const { items, hasMore } = await listPage(page, perPage);
    return { products: items.map(toProduct), hasMore };
  }

  async function getProduct(id: string): Promise<ShoplineProduct> {
    const body = await api(`/products/${id}`);
    return toProduct(body.data ?? body);
  }

  // Adds the photo to the END of the product's gallery. Existing photos are kept.
  async function addPhoto(productId: string, photo: ShoplinePhoto, filename: string) {
    const before = await getProduct(productId);
    if (before.mediaIds.length !== before.photoCount) {
      throw new Error(
        "Couldn't read this product's current photo list, so nothing was changed (to keep your photos safe).",
      );
    }

    const form = new FormData();
    form.append("data", new Blob([new Uint8Array(photo.data)], { type: photo.mime }), filename);
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

  // For outfit photos: adds the same photo to each product (e.g. the top and the skirt).
  // One product failing doesn't stop the others; each result says what happened.
  async function addPhotoToProducts(productIds: string[], photo: ShoplinePhoto, filename: string) {
    const results: { productId: string; mediaId?: string; error?: string }[] = [];
    for (const productId of productIds) {
      try {
        results.push({ productId, mediaId: await addPhoto(productId, photo, filename) });
      } catch (err) {
        results.push({ productId, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return results;
  }

  // Read-only health check for a first live run: changes nothing on the shop.
  async function check() {
    const { items } = await listPage(1, 3);
    const products = items.map(toProduct);
    const problems: string[] = [];
    if (items.length === 0) problems.push("No products came back. Check the key can read Products.");
    for (const p of products) {
      if (!p.imageUrl && p.photoCount > 0) problems.push(`"${p.title}": can't find its photo address.`);
      if (p.mediaIds.length !== p.photoCount) {
        problems.push(`"${p.title}": can't read its photo IDs, so uploads would be blocked.`);
      }
    }
    return { ok: problems.length === 0, products, problems, fieldsSeen: Object.keys(items[0] ?? {}) };
  }

  return { listProducts, getProduct, addPhoto, addPhotoToProducts, check };
}

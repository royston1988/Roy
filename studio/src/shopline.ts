import { config, live } from "./config.js";
import { demoProducts } from "./demo.js";
import type { Img } from "./images.js";
import { createShopline, type ShoplineProduct } from "./shopline-client.js";

export type Product = ShoplineProduct;

const shop = createShopline({ token: config.shoplineToken, apiUrl: config.shoplineApi });

export async function listProducts(page: number) {
  if (!live.shopline) return { products: demoProducts, hasMore: false };
  return shop.listProducts(page);
}

export async function getProduct(id: string): Promise<Product> {
  if (!live.shopline) {
    const product = demoProducts.find((p) => p.id === id);
    if (!product) throw new Error(`No demo product ${id}`);
    return product;
  }
  return shop.getProduct(id);
}

export async function addPhoto(productId: string, img: Img, filename: string) {
  if (!live.shopline) throw new Error("Shopline isn't connected yet (demo mode).");
  return shop.addPhoto(productId, img, filename);
}

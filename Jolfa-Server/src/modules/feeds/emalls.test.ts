import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import {
  createTestProduct,
  createTestSubcategory,
} from "../../../test/helpers/factories.js";
import { env } from "../../config/env.js";
import { prisma } from "../../shared/prisma.js";

const FEED = "/api/v1/feeds/emalls";

async function addImage(productId: string, url: string, isPrimary = true): Promise<void> {
  await prisma.productImage.create({ data: { productId, url, isPrimary } });
}

async function listedProduct(
  options: Parameters<typeof createTestProduct>[0] = {},
  image = "https://cdn.example/a.webp",
) {
  const product = await createTestProduct(options);
  await addImage(product.id, image);
  return product;
}

describe("Emalls product feed", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const site = (path: string): string => `${env.APP_URL.replace(/\/+$/, "")}${path}`;

  it("answers in the content type and shape Emalls asks for", async () => {
    await listedProduct();

    const res = await app.inject({ method: "GET", url: `${FEED}?page=1&item_per_page=50` });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(res.json()).toMatchObject({
      success: true,
      total_items: 1,
      pages_count: 1,
      item_per_page: 50,
      page_num: 1,
    });
    expect(res.json().products).toHaveLength(1);
    expect(res.json().data).toBeUndefined();
  });

  it("sends every field of a product under the name Emalls uses", async () => {
    const category = await createTestSubcategory({ name: "روغن زیتون" });
    const product = await listedProduct({
      title: "روغن زیتون بکر",
      slug: "olive-oil",
      price: 450_000,
      compareAtPrice: 500_000,
      stockQuantity: 3,
      guarantee: "ضمانت اصالت",
      categoryId: category.id,
    });

    const res = await app.inject({ method: "GET", url: FEED });

    expect(res.json().products[0]).toEqual({
      title: "روغن زیتون بکر",
      id: product.id,
      price: 450_000,
      old_price: 500_000,
      category: "روغن زیتون",
      image: "https://cdn.example/a.webp",
      guarantee: "ضمانت اصالت",
      is_available: true,
      url: site("/products/olive-oil"),
    });
  });

  it("leaves optional fields out rather than sending them empty", async () => {
    await listedProduct({ compareAtPrice: null, guarantee: null });

    const [product] = (await app.inject({ method: "GET", url: FEED })).json().products;

    expect(product).not.toHaveProperty("old_price");
    expect(product).not.toHaveProperty("guarantee");
    expect(product).not.toHaveProperty("color");
  });

  it("sends no old price for a stale compare price", async () => {
    await listedProduct({ price: 100_000, compareAtPrice: 100_000 });

    const [product] = (await app.inject({ method: "GET", url: FEED })).json().products;

    expect(product).not.toHaveProperty("old_price");
  });

  it("uses the shop's default guarantee when the product has none", async () => {
    await prisma.setting.create({
      data: { key: "default_guarantee", value: "گارانتی فروشگاه", group: "products" },
    });
    await listedProduct({ guarantee: null });

    const [product] = (await app.inject({ method: "GET", url: FEED })).json().products;

    expect(product.guarantee).toBe("گارانتی فروشگاه");
  });

  it("reports stock as a yes or no", async () => {
    await listedProduct({ stockQuantity: 0 });

    const [product] = (await app.inject({ method: "GET", url: FEED })).json().products;

    expect(product.is_available).toBe(false);
  });

  it("sends the primary image, as an absolute address", async () => {
    const product = await createTestProduct();
    await addImage(product.id, "uploads/second.webp", false);
    await addImage(product.id, "/uploads/primary.webp", true);

    const [listed] = (await app.inject({ method: "GET", url: FEED })).json().products;

    expect(listed.image).toBe(site("/uploads/primary.webp"));
  });

  it("leaves out hidden products, and products with no image to send", async () => {
    await listedProduct({ slug: "visible" });
    await listedProduct({ slug: "hidden", isActive: false });
    await createTestProduct({ slug: "no-image" });

    const body = (await app.inject({ method: "GET", url: FEED })).json();

    expect(body.products.map((p: { url: string }) => p.url)).toEqual([site("/products/visible")]);
    // The counts must agree with the list, or Emalls asks for pages that are empty.
    expect(body.total_items).toBe(1);
    expect(body.pages_count).toBe(1);
  });

  it("walks the whole catalogue once, with no gaps or repeats", async () => {
    const categoryId = (await createTestSubcategory()).id;
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      ids.push((await listedProduct({ categoryId })).id);
    }

    const seen: string[] = [];
    for (const page of [1, 2, 3]) {
      const body = (
        await app.inject({ method: "GET", url: `${FEED}?page=${page}&item_per_page=2` })
      ).json();
      expect(body.pages_count).toBe(3);
      expect(body.page_num).toBe(page);
      expect(body.item_per_page).toBe(2);
      seen.push(...body.products.map((p: { id: string }) => p.id));
    }

    expect(seen).toHaveLength(5);
    expect(new Set(seen)).toEqual(new Set(ids));
  });

  it("answers an empty page past the end, without an error", async () => {
    await listedProduct();

    const res = await app.inject({ method: "GET", url: `${FEED}?page=9` });

    expect(res.statusCode).toBe(200);
    expect(res.json().products).toEqual([]);
    expect(res.json().page_num).toBe(9);
  });

  it("answers an empty shop as a valid response", async () => {
    const res = await app.inject({ method: "GET", url: FEED });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ products: [], total_items: 0, pages_count: 0 });
  });

  it("falls back to sensible paging for odd values, and caps the page size", async () => {
    await listedProduct();

    for (const query of ["page=abc&item_per_page=xyz", "page=0&item_per_page=0", "page=-1"]) {
      const res = await app.inject({ method: "GET", url: `${FEED}?${query}` });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ page_num: 1, item_per_page: 50 });
    }

    const large = await app.inject({ method: "GET", url: `${FEED}?item_per_page=100000` });
    expect(large.json().item_per_page).toBe(200);

    const huge = await app.inject({ method: "GET", url: `${FEED}?page=99999999999999` });
    expect(huge.statusCode).toBe(200);
    expect(huge.json().page_num).toBe(1);
  });

  describe("by POST", () => {
    it.each([
      ["no body or type", {}],
      ["an empty JSON body", { headers: { "content-type": "application/json" }, payload: "" }],
      ["a JSON body", { headers: { "content-type": "application/json" }, payload: "{}" }],
      [
        "a form body",
        { headers: { "content-type": "application/x-www-form-urlencoded" }, payload: "a=1" },
      ],
    ])("reads the query string with %s", async (_name, request) => {
      await listedProduct();

      const res = await app.inject({
        method: "POST",
        url: `${FEED}?page=1&item_per_page=10`,
        ...request,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ item_per_page: 10, total_items: 1 });
    });
  });

  it("is not stopped by the API's per-IP limit part-way through a crawl", async () => {
    const res = await app.inject({ method: "GET", url: FEED });

    expect(res.headers["x-ratelimit-limit"]).toBeUndefined();
  });

  it("is left open to crawlers by robots.txt", async () => {
    const robots = (await app.inject({ method: "GET", url: "/robots.txt" })).body;
    const lines = robots.split("\n");

    expect(lines).toContain("Allow: /api/v1/feeds/");
    // First match wins for simpler crawlers, so it must come before the block.
    expect(lines.indexOf("Allow: /api/v1/feeds/")).toBeLessThan(lines.indexOf("Disallow: /api/"));
  });
});

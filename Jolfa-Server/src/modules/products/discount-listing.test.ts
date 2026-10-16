import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import { createTestProduct, createTestSubcategory } from "../../../test/helpers/factories.js";

/**
 * The storefront's «تخفیف‌دارها» carousel used to fetch the newest 50 products
 * and filter for a discount in the browser, so a discounted product outside
 * that window could never be shown — on the live catalogue that hid four of the
 * five discounted products. It now relies on this endpoint to answer the
 * question, which is why the window and the edges below are worth pinning.
 */
describe("GET /products?onSale=true", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  async function onSaleTitles(query = ""): Promise<string[]> {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/products?onSale=true&limit=100${query}`,
    });
    expect(res.statusCode).toBe(200);
    return (res.json().data.products as { title: string }[]).map((p) => p.title);
  }

  it("returns a discounted product however old it is", async () => {
    const categoryId = (await createTestSubcategory()).id;

    // Created first, so it is the OLDEST — the position the previous
    // implementation could not reach.
    await createTestProduct({
      categoryId,
      title: "قدیمی با تخفیف",
      price: 80_000,
      compareAtPrice: 120_000,
    });
    for (let i = 0; i < 5; i += 1) {
      await createTestProduct({ categoryId, title: `بدون تخفیف ${i}`, price: 100_000 });
    }

    expect(await onSaleTitles()).toEqual(["قدیمی با تخفیف"]);
  });

  it("leaves out products with no compare price", async () => {
    const categoryId = (await createTestSubcategory()).id;
    await createTestProduct({ categoryId, title: "ساده", price: 100_000 });

    expect(await onSaleTitles()).toEqual([]);
  });

  // A compareAtPrice at or below the price is a leftover from an earlier price
  // change, not a sale, and showing it would strike through a *lower* number.
  it("leaves out a stale compare price", async () => {
    const categoryId = (await createTestSubcategory()).id;
    await createTestProduct({
      categoryId,
      title: "قیمت قبلی کمتر",
      price: 100_000,
      compareAtPrice: 90_000,
    });
    await createTestProduct({
      categoryId,
      title: "قیمت قبلی برابر",
      price: 100_000,
      compareAtPrice: 100_000,
    });

    expect(await onSaleTitles()).toEqual([]);
  });

  it("never offers a hidden product to the storefront", async () => {
    const categoryId = (await createTestSubcategory()).id;
    await createTestProduct({
      categoryId,
      title: "مخفی با تخفیف",
      price: 80_000,
      compareAtPrice: 120_000,
      isActive: false,
    });

    expect(await onSaleTitles()).toEqual([]);
  });

  it("combines with a category filter", async () => {
    const wanted = await createTestSubcategory();
    const other = await createTestSubcategory();

    await createTestProduct({
      categoryId: wanted.id,
      title: "در دسته درست",
      price: 80_000,
      compareAtPrice: 120_000,
    });
    await createTestProduct({
      categoryId: other.id,
      title: "در دسته دیگر",
      price: 80_000,
      compareAtPrice: 120_000,
    });

    expect(await onSaleTitles(`&categorySlug=${wanted.slug}`)).toEqual(["در دسته درست"]);
  });
});

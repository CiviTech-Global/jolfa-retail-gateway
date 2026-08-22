import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import {
  createTestAdmin,
  createTestCategory,
  createTestProduct,
  createTestUser,
  getAuthToken,
} from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";

async function buildTestApp(): Promise<FastifyInstance> {
  return createTestApp();
}

const BASE = "/api/v1/products";

describe("GET /api/v1/products", () => {
  it("paginates with defaults page=1 limit=24 and reports meta", async () => {
    const app = await buildTestApp();
    const category = await createTestCategory();
    for (let i = 0; i < 3; i += 1) {
      await createTestProduct({ categoryId: category.id });
    }

    const res = await app.inject({ method: "GET", url: BASE });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.meta).toMatchObject({ page: 1, limit: 24, total: 3, totalPages: 1 });
    expect(body.products).toHaveLength(3);
    await app.close();
  });

  it("honours an explicit page/limit and computes totalPages", async () => {
    const app = await buildTestApp();
    const category = await createTestCategory();
    for (let i = 0; i < 5; i += 1) {
      await createTestProduct({ categoryId: category.id });
    }

    const res = await app.inject({ method: "GET", url: `${BASE}?page=2&limit=2` });

    const body = res.json().data;
    expect(body.products).toHaveLength(2);
    expect(body.meta).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
    await app.close();
  });

  it("excludes inactive products", async () => {
    const app = await buildTestApp();
    const category = await createTestCategory();
    await createTestProduct({ categoryId: category.id, slug: "live-product" });
    await createTestProduct({ categoryId: category.id, slug: "dead-product", isActive: false });

    const res = await app.inject({ method: "GET", url: BASE });

    const slugs = res.json().data.products.map((p: { slug: string }) => p.slug);
    expect(slugs).toContain("live-product");
    expect(slugs).not.toContain("dead-product");
    await app.close();
  });

  it("filters by categorySlug", async () => {
    const app = await buildTestApp();
    const wanted = await createTestCategory({ slug: "wanted-cat" });
    const other = await createTestCategory({ slug: "other-cat" });
    await createTestProduct({ categoryId: wanted.id, slug: "in-scope" });
    await createTestProduct({ categoryId: other.id, slug: "out-of-scope" });

    const res = await app.inject({ method: "GET", url: `${BASE}?categorySlug=wanted-cat` });

    expect(res.json().data.products.map((p: { slug: string }) => p.slug)).toEqual(["in-scope"]);
    await app.close();
  });

  it("searches title case-insensitively via q", async () => {
    const app = await buildTestApp();
    const category = await createTestCategory();
    await createTestProduct({ categoryId: category.id, title: "Blue Sneaker", slug: "blue-sneak" });
    await createTestProduct({ categoryId: category.id, title: "Red Hat", slug: "red-hat" });

    const res = await app.inject({ method: "GET", url: `${BASE}?q=sneaker` });

    expect(res.json().data.products.map((p: { slug: string }) => p.slug)).toEqual(["blue-sneak"]);
    await app.close();
  });

  it("filters by minPrice and maxPrice inclusively", async () => {
    const app = await buildTestApp();
    const category = await createTestCategory();
    await createTestProduct({ categoryId: category.id, price: 100, slug: "cheap" });
    await createTestProduct({ categoryId: category.id, price: 500, slug: "mid" });
    await createTestProduct({ categoryId: category.id, price: 900, slug: "pricey" });

    const res = await app.inject({ method: "GET", url: `${BASE}?minPrice=500&maxPrice=900` });

    const slugs = res.json().data.products.map((p: { slug: string }) => p.slug).sort();
    expect(slugs).toEqual(["mid", "pricey"]);
    await app.close();
  });

  it("returns only featured products when featured=true", async () => {
    const app = await buildTestApp();
    const category = await createTestCategory();
    const featured = await createTestProduct({ categoryId: category.id, slug: "star" });
    await prisma.product.update({ where: { id: featured.id }, data: { isFeatured: true } });
    await createTestProduct({ categoryId: category.id, slug: "plain" });

    const res = await app.inject({ method: "GET", url: `${BASE}?featured=true` });

    expect(res.json().data.products.map((p: { slug: string }) => p.slug)).toEqual(["star"]);
    await app.close();
  });

  it("sorts by price ascending and descending", async () => {
    const app = await buildTestApp();
    const category = await createTestCategory();
    await createTestProduct({ categoryId: category.id, price: 300, slug: "p300" });
    await createTestProduct({ categoryId: category.id, price: 100, slug: "p100" });
    await createTestProduct({ categoryId: category.id, price: 200, slug: "p200" });

    const asc = await app.inject({ method: "GET", url: `${BASE}?sort=price:asc` });
    expect(asc.json().data.products.map((p: { slug: string }) => p.slug)).toEqual([
      "p100",
      "p200",
      "p300",
    ]);

    const desc = await app.inject({ method: "GET", url: `${BASE}?sort=price:desc` });
    expect(desc.json().data.products.map((p: { slug: string }) => p.slug)).toEqual([
      "p300",
      "p200",
      "p100",
    ]);
    await app.close();
  });

  it("rejects an unrecognised sort value with 422", async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url: `${BASE}?sort=price:sideways` });

    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it("rejects a limit above the 100 maximum with 422", async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url: `${BASE}?limit=101` });

    expect(res.statusCode).toBe(422);
    await app.close();
  });
});

describe("GET /api/v1/products/:slug", () => {
  it("returns the product with images ordered primary-first", async () => {
    const app = await buildTestApp();
    const category = await createTestCategory();
    const product = await createTestProduct({ categoryId: category.id, slug: "with-images" });
    await prisma.productImage.createMany({
      data: [
        { productId: product.id, url: "/b.jpg", sortOrder: 1, isPrimary: false },
        { productId: product.id, url: "/a.jpg", sortOrder: 2, isPrimary: true },
      ],
    });

    const res = await app.inject({ method: "GET", url: `${BASE}/with-images` });

    expect(res.statusCode).toBe(200);
    const images = res.json().data.product.images as { url: string; isPrimary: boolean }[];
    expect(images[0]).toMatchObject({ url: "/a.jpg", isPrimary: true });
    await app.close();
  });

  it("includes up to 4 related products from the same category, excluding itself", async () => {
    const app = await buildTestApp();
    const category = await createTestCategory();
    await createTestProduct({ categoryId: category.id, slug: "subject" });
    for (let i = 0; i < 5; i += 1) {
      await createTestProduct({ categoryId: category.id });
    }
    const otherCategory = await createTestCategory();
    await createTestProduct({ categoryId: otherCategory.id, slug: "unrelated" });

    const res = await app.inject({ method: "GET", url: `${BASE}/subject` });

    const related = res.json().data.relatedProducts as { slug: string }[];
    expect(related).toHaveLength(4);
    expect(related.map((p) => p.slug)).not.toContain("subject");
    expect(related.map((p) => p.slug)).not.toContain("unrelated");
    await app.close();
  });

  it("returns 404 for an unknown slug", async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url: `${BASE}/nope` });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("returns 404 for an inactive product rather than exposing it", async () => {
    const app = await buildTestApp();
    const category = await createTestCategory();
    await createTestProduct({ categoryId: category.id, slug: "hidden-one", isActive: false });

    const res = await app.inject({ method: "GET", url: `${BASE}/hidden-one` });

    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe("POST /api/v1/products (admin)", () => {
  it("rejects unauthenticated with 401 and CUSTOMER with 403", async () => {
    const app = await buildTestApp();
    const category = await createTestCategory();
    const { user } = await createTestUser();
    const payload = { title: "تست", price: 1000, categoryId: category.id };

    const anon = await app.inject({ method: "POST", url: BASE, payload });
    expect(anon.statusCode).toBe(401);

    const customer = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload,
    });
    expect(customer.statusCode).toBe(403);
    await app.close();
  });

  it("creates a product with images and writes a CREATE audit row", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const category = await createTestCategory();

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: {
        title: "کفش ورزشی",
        slug: "sport-shoe",
        price: 250_000,
        stockQuantity: 7,
        categoryId: category.id,
        images: [
          { url: "/one.jpg", altText: "یک", sortOrder: 0, isPrimary: true },
          { url: "/two.jpg", sortOrder: 1 },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const product = res.json().data.product;
    expect(product.slug).toBe("sport-shoe");
    expect(product.price).toBe(250_000);
    expect(product.images).toHaveLength(2);
    expect(product.images[0]).toMatchObject({ url: "/one.jpg", isPrimary: true, altText: "یک" });

    const audits = await prisma.auditLog.findMany({ where: { entityType: "Product" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: "CREATE", entityId: product.id, userId: admin.id });
    await app.close();
  });

  // Pins `normalizeImages()`: with no explicit primary, the first image is promoted.
  it("promotes the first image to primary when none is flagged", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const category = await createTestCategory();

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: {
        title: "بدون تصویر اصلی",
        slug: "no-primary",
        price: 1000,
        categoryId: category.id,
        images: [{ url: "/first.jpg", sortOrder: 0 }, { url: "/second.jpg", sortOrder: 1 }],
      },
    });

    expect(res.statusCode).toBe(201);
    const images = res.json().data.product.images as { url: string; isPrimary: boolean }[];
    expect(images.find((i) => i.url === "/first.jpg")?.isPrimary).toBe(true);
    expect(images.find((i) => i.url === "/second.jpg")?.isPrimary).toBe(false);
    await app.close();
  });

  it("derives a slug from the title when omitted", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const category = await createTestCategory();

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { title: "Running Shoes Pro", price: 1000, categoryId: category.id },
    });

    expect(res.json().data.product.slug).toBe("running-shoes-pro");
    await app.close();
  });

  it("rejects a duplicate slug with 409", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const category = await createTestCategory();
    await createTestProduct({ categoryId: category.id, slug: "dupe-slug" });

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { title: "تکراری", slug: "dupe-slug", price: 1000, categoryId: category.id },
    });

    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it("rejects a duplicate SKU with 409", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const category = await createTestCategory();
    await createTestProduct({ categoryId: category.id, sku: "SKU-DUPE" });

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: {
        title: "اسکیو تکراری",
        slug: "sku-dupe-product",
        price: 1000,
        sku: "SKU-DUPE",
        categoryId: category.id,
      },
    });

    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it("returns 404 when categoryId does not exist", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: {
        title: "بی‌دسته",
        slug: "no-category",
        price: 1000,
        categoryId: "00000000-0000-4000-8000-000000000000",
      },
    });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("rejects a non-positive price with 422", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const category = await createTestCategory();

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { title: "رایگان", price: 0, categoryId: category.id },
    });

    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it("rejects more than 10 images with 422", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const category = await createTestCategory();

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: {
        title: "پر از تصویر",
        price: 1000,
        categoryId: category.id,
        images: Array.from({ length: 11 }, (_, i) => ({ url: `/img-${i}.jpg` })),
      },
    });

    expect(res.statusCode).toBe(422);
    await app.close();
  });
});

describe("PATCH /api/v1/products/:slug (admin)", () => {
  it("applies a partial update without clobbering other fields", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const category = await createTestCategory();
    await createTestProduct({
      categoryId: category.id,
      slug: "patch-product",
      title: "عنوان اصلی",
      price: 5000,
      stockQuantity: 4,
    });

    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/patch-product`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { price: 7500 },
    });

    expect(res.statusCode).toBe(200);
    const product = res.json().data.product;
    expect(product.price).toBe(7500);
    expect(product.title).toBe("عنوان اصلی");
    expect(product.stockQuantity).toBe(4);
    await app.close();
  });

  // The plan asked to pin down replace-vs-append semantics explicitly.
  it("REPLACES the image set when images are supplied, rather than appending", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const category = await createTestCategory();
    const product = await createTestProduct({ categoryId: category.id, slug: "image-swap" });
    await prisma.productImage.createMany({
      data: [
        { productId: product.id, url: "/old-1.jpg", isPrimary: true },
        { productId: product.id, url: "/old-2.jpg" },
      ],
    });

    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/image-swap`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { images: [{ url: "/new-only.jpg", isPrimary: true }] },
    });

    expect(res.statusCode).toBe(200);
    const images = res.json().data.product.images as { url: string }[];
    expect(images.map((i) => i.url)).toEqual(["/new-only.jpg"]);
    expect(await prisma.productImage.count({ where: { productId: product.id } })).toBe(1);
    await app.close();
  });

  it("leaves existing images untouched when images is omitted", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const category = await createTestCategory();
    const product = await createTestProduct({ categoryId: category.id, slug: "keep-images" });
    await prisma.productImage.create({
      data: { productId: product.id, url: "/keep.jpg", isPrimary: true },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/keep-images`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { title: "عنوان تازه" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.product.images.map((i: { url: string }) => i.url)).toEqual([
      "/keep.jpg",
    ]);
    await app.close();
  });

  it("writes an UPDATE audit row capturing the change", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const category = await createTestCategory();
    await createTestProduct({ categoryId: category.id, slug: "audited-update", price: 1000 });

    await app.inject({
      method: "PATCH",
      url: `${BASE}/audited-update`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { price: 2000 },
    });

    const audits = await prisma.auditLog.findMany({
      where: { entityType: "Product", action: "UPDATE" },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.userId).toBe(admin.id);
    await app.close();
  });

  it("returns 404 for an unknown slug", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/ghost-product`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { price: 100 },
    });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("rejects a CUSTOMER token with 403", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const category = await createTestCategory();
    await createTestProduct({ categoryId: category.id, slug: "guarded-product" });

    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/guarded-product`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: { price: 1 },
    });

    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe("DELETE /api/v1/products/:slug (admin)", () => {
  // Deliberately different from categories: products are SOFT-deleted.
  it("soft-deletes by setting isActive=false, keeping the row", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const category = await createTestCategory();
    await createTestProduct({ categoryId: category.id, slug: "soft-delete-me" });

    const res = await app.inject({
      method: "DELETE",
      url: `${BASE}/soft-delete-me`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(200);
    const row = await prisma.product.findUnique({ where: { slug: "soft-delete-me" } });
    expect(row).not.toBeNull();
    expect(row?.isActive).toBe(false);

    // ...and it disappears from the public listing.
    const list = await app.inject({ method: "GET", url: BASE });
    expect(list.json().data.products.map((p: { slug: string }) => p.slug)).not.toContain(
      "soft-delete-me",
    );
    await app.close();
  });

  it("writes a DELETE audit row", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const category = await createTestCategory();
    await createTestProduct({ categoryId: category.id, slug: "audited-delete" });

    await app.inject({
      method: "DELETE",
      url: `${BASE}/audited-delete`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    const audits = await prisma.auditLog.findMany({
      where: { entityType: "Product", action: "DELETE" },
    });
    expect(audits).toHaveLength(1);
    await app.close();
  });

  it("returns 404 for an unknown slug and 401 when unauthenticated", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const missing = await app.inject({
      method: "DELETE",
      url: `${BASE}/not-here`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });
    expect(missing.statusCode).toBe(404);

    const anon = await app.inject({ method: "DELETE", url: `${BASE}/anything` });
    expect(anon.statusCode).toBe(401);
    await app.close();
  });
});

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

const BASE = "/api/v1/demo";

async function runAction(app: FastifyInstance, token: string, action: "seed" | "clear") {
  return app.inject({
    method: "POST",
    url: BASE,
    headers: { authorization: `Bearer ${token}` },
    payload: { action },
  });
}

/** Row counts across every table the demo tool touches. */
async function demoCounts() {
  const [categories, products, banners, sections, settings, orders, snapshots] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.banner.count(),
    prisma.homepageSection.count(),
    prisma.setting.count(),
    prisma.order.count(),
    prisma.demoSnapshot.count(),
  ]);
  return { categories, products, banners, sections, settings, orders, snapshots };
}

describe("POST /api/v1/demo — authorization", () => {
  it("rejects anonymous with 401 and CUSTOMER with 403", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();

    const anon = await app.inject({ method: "POST", url: BASE, payload: { action: "seed" } });
    expect(anon.statusCode).toBe(401);

    const forbidden = await runAction(app, getAuthToken(app, user), "seed");
    expect(forbidden.statusCode).toBe(403);
    await app.close();
  });

  it("rejects an unrecognised action with 422", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { action: "destroy" },
    });

    expect(res.statusCode).toBe(422);
    await app.close();
  });
});

describe("POST /api/v1/demo — seed", () => {
  it("creates demo content and records a snapshot of everything it made", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await runAction(app, getAuthToken(app, admin), "seed");

    expect(res.statusCode).toBe(200);
    expect(res.json().data.action).toBe("seed");

    const counts = await demoCounts();
    expect(counts.categories).toBeGreaterThan(0);
    expect(counts.products).toBeGreaterThan(0);
    expect(counts.banners).toBeGreaterThan(0);
    expect(counts.sections).toBeGreaterThan(0);
    expect(counts.snapshots).toBeGreaterThan(0);
    await app.close();
  });

  // The exact regression the earlier clearDemoData() settings bug fell into.
  it("is idempotent: seeding twice produces the same row counts, not duplicates", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);

    await runAction(app, token, "seed");
    const afterFirst = await demoCounts();

    const second = await runAction(app, token, "seed");
    expect(second.statusCode).toBe(200);
    const afterSecond = await demoCounts();

    expect(afterSecond.categories).toBe(afterFirst.categories);
    expect(afterSecond.products).toBe(afterFirst.products);
    expect(afterSecond.banners).toBe(afterFirst.banners);
    expect(afterSecond.sections).toBe(afterFirst.sections);
    expect(afterSecond.settings).toBe(afterFirst.settings);
    // Demo orders have a time-based orderNumber with no natural key, so they
    // are the easiest thing to accidentally duplicate on re-seed.
    expect(afterSecond.orders).toBe(afterFirst.orders);
    // The snapshot table must not grow either — clear() tolerates duplicate
    // rows, but they would accumulate on every seed run.
    expect(afterSecond.snapshots).toBe(afterFirst.snapshots);
    await app.close();
  });

  it("produces content that is visible on the public storefront endpoints", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    await runAction(app, getAuthToken(app, admin), "seed");

    const products = await app.inject({ method: "GET", url: "/api/v1/products" });
    expect(products.json().data.products.length).toBeGreaterThan(0);

    const categories = await app.inject({ method: "GET", url: "/api/v1/categories" });
    expect(categories.json().data.categories.length).toBeGreaterThan(0);

    const sections = await app.inject({ method: "GET", url: "/api/v1/homepage-sections/public" });
    expect((sections.json().data as unknown[]).length).toBeGreaterThan(0);
    await app.close();
  });
});

describe("POST /api/v1/demo — clear", () => {
  it("removes everything the seed created and empties the snapshot table", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);

    await runAction(app, token, "seed");
    const clear = await runAction(app, token, "clear");

    expect(clear.statusCode).toBe(200);
    expect(clear.json().data.action).toBe("clear");

    const counts = await demoCounts();
    expect(counts.snapshots).toBe(0);
    expect(counts.categories).toBe(0);
    expect(counts.products).toBe(0);
    expect(counts.banners).toBe(0);
    expect(counts.sections).toBe(0);
    expect(counts.orders).toBe(0);
    await app.close();
  });

  it("is a harmless no-op when nothing has been seeded", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await runAction(app, getAuthToken(app, admin), "clear");

    expect(res.statusCode).toBe(200);
    expect((await demoCounts()).snapshots).toBe(0);
    await app.close();
  });

  it("can be run twice in a row without erroring", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);

    await runAction(app, token, "seed");
    await runAction(app, token, "clear");
    const second = await runAction(app, token, "clear");

    expect(second.statusCode).toBe(200);
    await app.close();
  });

  /**
   * The key protection: content an admin created by hand, in their OWN
   * category, must survive a demo clear.
   */
  it("leaves manually-created content in a non-demo category untouched", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);

    const myCategory = await createTestCategory({ slug: "my-own-category" });
    const myProduct = await createTestProduct({
      categoryId: myCategory.id,
      slug: "my-own-product",
    });

    await runAction(app, token, "seed");
    await runAction(app, token, "clear");

    expect(await prisma.category.findUnique({ where: { id: myCategory.id } })).not.toBeNull();
    expect(await prisma.product.findUnique({ where: { id: myProduct.id } })).not.toBeNull();
    await app.close();
  });

  it("preserves a manually-created banner, section and setting across a clear", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);

    const banner = await prisma.banner.create({
      data: { title: "بنر دستی", imageUrl: "/manual.jpg" },
    });
    const section = await prisma.homepageSection.create({
      data: { key: "manual-section", title: "بخش دستی", type: "hero" },
    });
    const setting = await prisma.setting.create({
      data: { key: "manual_setting", value: "keep-me", isPublic: true },
    });

    await runAction(app, token, "seed");
    await runAction(app, token, "clear");

    expect(await prisma.banner.findUnique({ where: { id: banner.id } })).not.toBeNull();
    expect(await prisma.homepageSection.findUnique({ where: { id: section.id } })).not.toBeNull();
    expect((await prisma.setting.findUnique({ where: { id: setting.id } }))?.value).toBe("keep-me");
    await app.close();
  });

  /**
   * Documents a DELIBERATE and destructive choice in `clearDemoData()`: it
   * deletes every product whose `categoryId` is a demo category, including
   * products an admin created by hand there. The comment in the service calls
   * this out explicitly. Pinned so the blast radius can't widen unnoticed.
   */
  it("DOES delete a hand-made product that was filed under a demo category", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);

    await runAction(app, token, "seed");
    const demoCategory = await prisma.category.findFirstOrThrow();
    const manualProduct = await createTestProduct({
      categoryId: demoCategory.id,
      slug: "manual-in-demo-category",
    });

    await runAction(app, token, "clear");

    expect(await prisma.product.findUnique({ where: { id: manualProduct.id } })).toBeNull();
    await app.close();
  });

  it("leaves user accounts untouched", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const { user: customer } = await createTestUser();
    const token = getAuthToken(app, admin);

    await runAction(app, token, "seed");
    await runAction(app, token, "clear");

    expect(await prisma.user.findUnique({ where: { id: customer.id } })).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: admin.id } })).not.toBeNull();
    await app.close();
  });

  it("supports a full seed -> clear -> seed cycle returning to the same counts", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);

    await runAction(app, token, "seed");
    const first = await demoCounts();
    await runAction(app, token, "clear");
    await runAction(app, token, "seed");
    const second = await demoCounts();

    expect(second.categories).toBe(first.categories);
    expect(second.products).toBe(first.products);
    expect(second.banners).toBe(first.banners);
    expect(second.sections).toBe(first.sections);
    await app.close();
  });
});

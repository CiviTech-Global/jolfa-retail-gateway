import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import {
  createTestAdmin,
  createTestProduct,
  createTestSubcategory,
  createTestUser,
  getAuthToken,
} from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";
import { normalizeSearchTerm, searchVariants } from "../../shared/search-text.js";
import { adjustPrice } from "./bulk-price.service.js";

const SEARCH = "/api/v1/admin/search";
const BULK = "/api/v1/admin/products/bulk-price";

describe("Persian search normalisation", () => {
  // The whole reason the search box can be trusted. Persian is typed with
  // interchangeable letterforms and three digit scripts, and a plain `contains`
  // returns nothing for input a human calls identical.
  it("folds Arabic yeh and kaf onto their Farsi forms", () => {
    expect(normalizeSearchTerm("كيف")).toBe("کیف");
    expect(normalizeSearchTerm("مكتب")).toBe("مکتب");
  });

  it("converts Persian and Arabic-Indic digits to ASCII", () => {
    expect(normalizeSearchTerm("۰۹۱۲۳۴۵۶۷۸۹")).toBe("09123456789");
    expect(normalizeSearchTerm("٠١٢٣")).toBe("0123");
  });

  it("strips the invisible joiners that compound words carry", () => {
    expect(normalizeSearchTerm("می‌خواهم")).toBe("میخواهم");
  });

  // Searching must work whichever spelling the row was SAVED with, so the query
  // is expanded rather than the column normalised.
  it("offers both spellings so either stored form is matched", () => {
    expect(searchVariants("کیف")).toEqual(["کیف", "كيف"]);
  });

  it("returns a single variant when there is nothing to fold", () => {
    expect(searchVariants("شامپو")).toEqual(["شامپو"]);
  });

  it("returns nothing for an empty query", () => {
    expect(searchVariants("   ")).toEqual([]);
  });
});

describe("price adjustment arithmetic", () => {
  it("applies a percentage discount", () => {
    expect(adjustPrice(100_000, { mode: "percent", direction: "decrease", value: 20 })).toBe(80_000);
  });

  it("applies a fixed increase", () => {
    expect(adjustPrice(100_000, { mode: "fixed", direction: "increase", value: 15_000 })).toBe(
      115_000,
    );
  });

  it("rounds to the requested step so prices stay tidy", () => {
    // Without this a 12% change fills the catalogue with prices like 87,431.
    expect(
      adjustPrice(99_000, { mode: "percent", direction: "decrease", value: 12, roundTo: 1_000 }),
    ).toBe(87_000);
  });

  // A repeated deep discount would otherwise reach zero, and a zero-price
  // product is an order the shop fulfils for free.
  it("never takes a price below the floor", () => {
    expect(adjustPrice(2_000, { mode: "percent", direction: "decrease", value: 95 })).toBe(1_000);
    expect(adjustPrice(1_000, { mode: "fixed", direction: "decrease", value: 999_999 })).toBe(1_000);
  });
});

describe("admin search endpoint", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  const adminAuth = async () => {
    const { user } = await createTestAdmin();
    return { authorization: `Bearer ${getAuthToken(app, user)}` };
  };

  it("finds a product by title", async () => {
    await createTestProduct({ title: "شامپو ضد شوره" });

    const res = await app.inject({
      method: "GET",
      url: `${SEARCH}?q=${encodeURIComponent("شامپو")}`,
      headers: await adminAuth(),
    });

    expect(res.statusCode).toBe(200);
    const products = res.json().data.groups.find((g: { entity: string }) => g.entity === "product");
    expect(products.hits[0].title).toBe("شامپو ضد شوره");
    expect(products.hits[0].url).toContain("/admin/products/");
  });

  it("finds a product by SKU", async () => {
    await createTestProduct({ title: "کرم مرطوب‌کننده", sku: "SKU-PALETTE-9" });

    const res = await app.inject({
      method: "GET",
      url: `${SEARCH}?q=PALETTE`,
      headers: await adminAuth(),
    });

    const products = res.json().data.groups.find((g: { entity: string }) => g.entity === "product");
    expect(products.hits).toHaveLength(1);
  });

  // The case the normalisation exists for, end to end.
  it("finds a product saved with Farsi yeh when the admin types Arabic yeh", async () => {
    await createTestProduct({ title: "کیف لوازم آرایش" });

    const res = await app.inject({
      method: "GET",
      url: `${SEARCH}?q=${encodeURIComponent("كيف")}`,
      headers: await adminAuth(),
    });

    const products = res.json().data.groups.find((g: { entity: string }) => g.entity === "product");
    expect(products?.hits ?? []).toHaveLength(1);
  });

  it("finds a customer by mobile typed in Persian digits", async () => {
    await createTestUser({ phone: "09121112233", firstName: "سارا" });

    const res = await app.inject({
      method: "GET",
      url: `${SEARCH}?q=${encodeURIComponent("۰۹۱۲۱۱۱۲۲۳۳")}`,
      headers: await adminAuth(),
    });

    const users = res.json().data.groups.find((g: { entity: string }) => g.entity === "user");
    expect(users.hits[0].subtitle).toBe("09121112233");
  });

  it("returns no groups for an empty query instead of everything", async () => {
    await createTestProduct();

    const res = await app.inject({ method: "GET", url: `${SEARCH}?q=`, headers: await adminAuth() });

    expect(res.json().data.groups).toEqual([]);
  });

  it("omits groups with no matches so the UI shows no empty headings", async () => {
    await createTestProduct({ title: "محصول یکتا" });

    const res = await app.inject({
      method: "GET",
      url: `${SEARCH}?q=${encodeURIComponent("یکتا")}`,
      headers: await adminAuth(),
    });

    const entities = res.json().data.groups.map((g: { entity: string }) => g.entity);
    expect(entities).toEqual(["product"]);
  });

  it("reports the total even when it exceeds the hits returned", async () => {
    const subcategory = await createTestSubcategory();
    for (let i = 0; i < 7; i += 1) {
      await createTestProduct({ title: `دستمال کاغذی ${i}`, categoryId: subcategory.id });
    }

    const res = await app.inject({
      method: "GET",
      url: `${SEARCH}?q=${encodeURIComponent("دستمال")}`,
      headers: await adminAuth(),
    });

    const products = res.json().data.groups.find((g: { entity: string }) => g.entity === "product");
    expect(products.hits).toHaveLength(5);
    expect(products.total).toBe(7);
  });

  it("refuses a customer", async () => {
    const { user } = await createTestUser();
    const res = await app.inject({
      method: "GET",
      url: `${SEARCH}?q=test`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("bulk price adjustment", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  const adminAuth = async () => {
    const { user } = await createTestAdmin();
    return { authorization: `Bearer ${getAuthToken(app, user)}` };
  };

  // The guard that matters most: a client that forgets the flag must get a
  // preview, never a catalogue-wide price change.
  it("previews without writing when dryRun is omitted", async () => {
    const product = await createTestProduct({ price: 100_000 });

    const res = await app.inject({
      method: "POST",
      url: BULK,
      headers: await adminAuth(),
      payload: {
        scope: { kind: "products", productIds: [product.id] },
        mode: "percent",
        direction: "decrease",
        value: 20,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.dryRun).toBe(true);
    expect(res.json().data.sample[0]).toMatchObject({ before: 100_000, after: 80_000 });

    const unchanged = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(unchanged.price).toBe(100_000);
  });

  it("applies the change when dryRun is false", async () => {
    const product = await createTestProduct({ price: 100_000 });

    await app.inject({
      method: "POST",
      url: BULK,
      headers: await adminAuth(),
      payload: {
        scope: { kind: "products", productIds: [product.id] },
        mode: "percent",
        direction: "decrease",
        value: 20,
        dryRun: false,
      },
    });

    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.price).toBe(80_000);
  });

  it("records the old price as the struck-through price when asked", async () => {
    const product = await createTestProduct({ price: 50_000 });

    await app.inject({
      method: "POST",
      url: BULK,
      headers: await adminAuth(),
      payload: {
        scope: { kind: "products", productIds: [product.id] },
        mode: "percent",
        direction: "decrease",
        value: 10,
        setCompareAtPrice: true,
        dryRun: false,
      },
    });

    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.price).toBe(45_000);
    expect(updated.compareAtPrice).toBe(50_000);
  });

  it("covers a category and its subcategories", async () => {
    const parent = await createTestSubcategory();
    const top = await prisma.category.findUniqueOrThrow({ where: { id: parent.parentId! } });
    const product = await createTestProduct({ categoryId: parent.id, price: 10_000 });

    const res = await app.inject({
      method: "POST",
      url: BULK,
      headers: await adminAuth(),
      // Selecting the TOP-level category must reach products in its children,
      // which is where every product actually lives.
      payload: {
        scope: { kind: "category", categoryId: top.id },
        mode: "fixed",
        direction: "increase",
        value: 5_000,
        dryRun: false,
      },
    });

    expect(res.json().data.changed).toBe(1);
    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.price).toBe(15_000);
  });

  it("refuses a percentage above 95, which is almost always a typo", async () => {
    const product = await createTestProduct();

    const res = await app.inject({
      method: "POST",
      url: BULK,
      headers: await adminAuth(),
      payload: {
        scope: { kind: "products", productIds: [product.id] },
        mode: "percent",
        direction: "decrease",
        value: 100,
      },
    });

    expect(res.statusCode).toBe(422);
  });

  it("refuses a scope that matches nothing rather than reporting success", async () => {
    const res = await app.inject({
      method: "POST",
      url: BULK,
      headers: await adminAuth(),
      payload: {
        scope: { kind: "category", categoryId: "00000000-0000-0000-0000-000000000000" },
        mode: "percent",
        direction: "decrease",
        value: 10,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("refuses a customer", async () => {
    const { user } = await createTestUser();
    const product = await createTestProduct();

    const res = await app.inject({
      method: "POST",
      url: BULK,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: {
        scope: { kind: "products", productIds: [product.id] },
        mode: "percent",
        direction: "decrease",
        value: 10,
        dryRun: false,
      },
    });

    expect(res.statusCode).toBe(403);
    const untouched = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(untouched.price).toBe(100_000);
  });

  it("writes one audit entry for the whole operation", async () => {
    const { user } = await createTestAdmin();
    const first = await createTestProduct({ price: 20_000 });
    const second = await createTestProduct({ price: 30_000 });

    await app.inject({
      method: "POST",
      url: BULK,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: {
        scope: { kind: "products", productIds: [first.id, second.id] },
        mode: "percent",
        direction: "increase",
        value: 10,
        dryRun: false,
      },
    });

    const entries = await prisma.auditLog.findMany({ where: { userId: user.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0].metadata).toMatchObject({ bulkPriceAdjustment: true, changed: 2 });
  });
});

describe("hidden products are not publicly enumerable", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  // Regression. The admin list needs to reach switched-off products, and the
  // filter that allows it was briefly added to the PUBLIC /products route,
  // where it overrode the active-only default — so anyone could enumerate
  // drafts and discontinued lines by asking for isActive=false.
  it("ignores isActive on the public route", async () => {
    await createTestProduct({ title: "محصول پنهان", isActive: false });

    const res = await app.inject({ method: "GET", url: "/api/v1/products?isActive=false&limit=50" });

    expect(res.statusCode).toBe(200);
    const titles = res.json().data.products.map((p: { title: string }) => p.title);
    expect(titles).not.toContain("محصول پنهان");
  });

  it("still hides inactive products when no filter is sent", async () => {
    await createTestProduct({ title: "محصول پنهان دوم", isActive: false });

    const res = await app.inject({ method: "GET", url: "/api/v1/products?limit=50" });

    const titles = res.json().data.products.map((p: { title: string }) => p.title);
    expect(titles).not.toContain("محصول پنهان دوم");
  });

  it("lets an admin find them through the guarded route", async () => {
    await createTestProduct({ title: "محصول پنهان سوم", isActive: false });
    const { user } = await createTestAdmin();

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/products?isActive=false&limit=50",
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
    });

    expect(res.statusCode).toBe(200);
    const titles = res.json().data.products.map((p: { title: string }) => p.title);
    expect(titles).toContain("محصول پنهان سوم");
  });

  it("refuses the admin route without a token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/products?isActive=false" });
    expect(res.statusCode).toBe(401);
  });
});

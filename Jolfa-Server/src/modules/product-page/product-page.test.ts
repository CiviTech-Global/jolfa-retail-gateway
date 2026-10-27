import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import { createTestProduct } from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";
import { env } from "../../config/env.js";

/**
 * Torob reads the HTML of a product page without running JavaScript. These
 * tests read it the same way: the raw response body is all that counts.
 */
describe("GET /products/:slug (server-rendered head)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  async function page(slug: string) {
    return app.inject({ method: "GET", url: `/products/${slug}` });
  }

  /** The `content` of `<meta name|property="key">`, or undefined. */
  function meta(html: string, key: string): string | undefined {
    const match = html.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`));
    return match?.[1];
  }

  async function setSetting(key: string, value: string): Promise<void> {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value, group: "test", isPublic: true },
    });
  }

  it("carries every tag Torob asked for", async () => {
    await setSetting("site_title", "ارس پرو");
    const product = await createTestProduct({
      title: "عسل کنار",
      slug: "konar-honey",
      price: 450_000,
      compareAtPrice: 520_000,
      stockQuantity: 7,
      guarantee: "ضمانت اصالت کالا",
    });
    // Stored relative, as demo images and older rows are.
    await prisma.productImage.create({
      data: { productId: product.id, url: "/uploads/honey.webp", isPrimary: true },
    });

    const res = await page("konar-honey");
    const html = res.body;

    expect(res.statusCode).toBe(200);
    expect(meta(html, "product_id")).toBe(product.id);
    expect(meta(html, "product_name")).toBe("عسل کنار");
    expect(meta(html, "product_price")).toBe("450000");
    expect(meta(html, "product_old_price")).toBe("520000");
    expect(meta(html, "availability")).toBe("instock");
    expect(meta(html, "guarantee")).toBe("ضمانت اصالت کالا");
    expect(meta(html, "og:image")).toBe(`${env.APP_URL}/uploads/honey.webp`);
    expect(html).toContain(`<link rel="canonical" href="${env.APP_URL}/products/konar-honey"`);
  });

  it("replaces the shell's title and leaves the rest of the shell intact", async () => {
    await setSetting("site_title", "ارس پرو");
    await createTestProduct({ title: "زعفران", slug: "saffron" });

    const html = (await page("saffron")).body;

    expect(html.match(/<title/g)).toHaveLength(1);
    expect(html).toContain("<title data-server-head>زعفران | ارس پرو</title>");
    expect(html).not.toContain("ارس پرو | Araspro");
    // ENAMAD's tag and the app bundle must survive, or the seal and the page break.
    expect(html).toContain('<meta name="enamad" content="71332061" />');
    expect(html).toContain('src="/assets/index-test.js"');
    expect(html).toContain('<div id="root"></div>');
  });

  it("sends no old price unless it is really a discount", async () => {
    await createTestProduct({ slug: "plain", price: 100_000 });
    await createTestProduct({ slug: "stale", price: 100_000, compareAtPrice: 90_000 });

    expect(meta((await page("plain")).body, "product_old_price")).toBeUndefined();
    expect(meta((await page("stale")).body, "product_old_price")).toBeUndefined();
  });

  it("reports an empty product as out of stock", async () => {
    await createTestProduct({ slug: "sold-out", stockQuantity: 0 });

    const html = (await page("sold-out")).body;
    expect(meta(html, "availability")).toBe("outofstock");
    expect(html).toContain('"availability":"https://schema.org/OutOfStock"');
  });

  it("uses the shop's default guarantee when the product has none", async () => {
    await setSetting("default_guarantee", "گارانتی سلامت فیزیکی");
    await createTestProduct({ slug: "own", guarantee: "گارانتی ۱۸ ماهه" });
    await createTestProduct({ slug: "inherits" });

    expect(meta((await page("own")).body, "guarantee")).toBe("گارانتی ۱۸ ماهه");
    expect(meta((await page("inherits")).body, "guarantee")).toBe("گارانتی سلامت فیزیکی");
  });

  it("omits the guarantee when neither the product nor the shop sets one", async () => {
    await createTestProduct({ slug: "no-guarantee" });

    expect(meta((await page("no-guarantee")).body, "guarantee")).toBeUndefined();
  });

  it("prices the structured data in Rial, since schema.org has no Toman", async () => {
    await createTestProduct({ slug: "rial", price: 123_000 });

    expect((await page("rial")).body).toContain('"price":1230000,"priceCurrency":"IRR"');
  });

  it("answers 404 for a missing or hidden product, with the app still loading", async () => {
    await createTestProduct({ slug: "hidden", isActive: false });

    for (const slug of ["does-not-exist", "hidden"]) {
      const res = await page(slug);
      expect(res.statusCode).toBe(404);
      expect(meta(res.body, "robots")).toBe("noindex");
      expect(meta(res.body, "product_id")).toBeUndefined();
      expect(res.body).toContain('src="/assets/index-test.js"');
    }
  });

  it("escapes product text so it cannot inject markup", async () => {
    const hostile = `"><script>alert(1)</script>`;
    await createTestProduct({ slug: "hostile", title: hostile });

    const html = (await page("hostile")).body;
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(meta(html, "product_name")).toBe("&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
    // Inside the JSON-LD a raw "</script>" would end the element early.
    expect(html).toContain("\\u003c/script>");
  });

  it("serves the plain shell when the product lookup fails", async () => {
    await createTestProduct({ slug: "db-down" });
    vi.spyOn(prisma.product, "findUnique").mockRejectedValueOnce(new Error("connection lost"));

    const res = await page("db-down");
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("ارس پرو | Araspro");
    expect(meta(res.body, "product_id")).toBeUndefined();
  });

  it("sends headers fit for an HTML page, not the API's", async () => {
    await createTestProduct({ slug: "headers" });

    const res = await page("headers");
    expect(res.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(res.headers["cache-control"]).toBe("no-cache");
    // The API's CSP forbids every script, which would stop the app loading.
    expect(res.headers["content-security-policy"]).toBeUndefined();
    // Crawlers are not counted against the API's per-IP bucket.
    expect(res.headers["x-ratelimit-limit"]).toBeUndefined();
  });
});

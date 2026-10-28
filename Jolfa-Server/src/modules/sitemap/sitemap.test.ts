import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import {
  createTestCategory,
  createTestProduct,
  createTestSubcategory,
} from "../../../test/helpers/factories.js";
import { env } from "../../config/env.js";
import { prisma } from "../../shared/prisma.js";

describe("crawler files", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const site = (path: string): string => `${env.APP_URL.replace(/\/+$/, "")}${path}`;

  function locs(xml: string): string[] {
    return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1] ?? "");
  }

  describe("GET /sitemap.xml", () => {
    it("is XML, not the storefront's HTML shell", async () => {
      const res = await app.inject({ method: "GET", url: "/sitemap.xml" });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("application/xml; charset=utf-8");
      expect(res.body.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
      expect(res.body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    });

    // Torob asked for the newest product first.
    it("lists active products newest first, each with its last change", async () => {
      const categoryId = (await createTestSubcategory()).id;
      // Explicit times: three rows created in one test can share a millisecond.
      for (const [slug, day] of [["oldest", 1], ["middle", 2], ["newest", 3]] as const) {
        const product = await createTestProduct({ categoryId, slug });
        await prisma.product.update({
          where: { id: product.id },
          data: { createdAt: new Date(`2026-10-0${day}T12:00:00Z`) },
        });
      }

      const xml = (await app.inject({ method: "GET", url: "/sitemap.xml" })).body;
      const products = locs(xml).filter((loc) => loc.includes("/products/"));

      expect(products).toEqual([
        site("/products/newest"),
        site("/products/middle"),
        site("/products/oldest"),
      ]);
      expect(xml).toMatch(
        /<loc>[^<]*\/products\/newest<\/loc><lastmod>\d{4}-\d{2}-\d{2}T[\d:.]+Z<\/lastmod>/,
      );
    });

    it("leaves out hidden products and categories", async () => {
      const hiddenCategory = await createTestCategory({ slug: "hidden-cat", isActive: false });
      const category = await createTestSubcategory({ slug: "visible-cat" });
      await createTestProduct({ categoryId: category.id, slug: "visible" });
      await createTestProduct({ categoryId: category.id, slug: "hidden", isActive: false });

      const all = locs((await app.inject({ method: "GET", url: "/sitemap.xml" })).body);

      expect(all).toContain(site("/products/visible"));
      expect(all).toContain(site("/categories/visible-cat"));
      expect(all).not.toContain(site("/products/hidden"));
      expect(all).not.toContain(site(`/categories/${hiddenCategory.slug}`));
    });

    it("includes the home page and the product list", async () => {
      const all = locs((await app.inject({ method: "GET", url: "/sitemap.xml" })).body);

      expect(all.slice(0, 2)).toEqual([site("/"), site("/products")]);
    });
  });

  describe("GET /robots.txt", () => {
    it("points crawlers at the sitemap and away from private pages", async () => {
      const res = await app.inject({ method: "GET", url: "/robots.txt" });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("text/plain; charset=utf-8");
      expect(res.body).toContain(`Sitemap: ${site("/sitemap.xml")}`);
      expect(res.body).toContain("Disallow: /admin");
      expect(res.body).toContain("Disallow: /checkout");
      // Product pages are exactly what crawlers should reach.
      expect(res.body).not.toMatch(/Disallow: \/products/);
    });
  });
});

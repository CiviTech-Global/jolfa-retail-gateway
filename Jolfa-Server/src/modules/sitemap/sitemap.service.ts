import { env } from "../../config/env.js";
import { prisma } from "../../shared/prisma.js";

/**
 * `/sitemap.xml` and `/robots.txt`.
 *
 * Torob finds products by crawling, and asked for a sitemap listing them newest
 * first; the product pages themselves already carry the tags it reads (see the
 * product-page module). Search engines use the same file.
 *
 * Before this, both URLs fell through to the storefront shell and answered 200
 * with an HTML page, so a crawler asking for the sitemap was told it had one.
 */

function siteUrl(path: string): string {
  return `${env.APP_URL.replace(/\/+$/, "")}${path}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc: string, lastmod?: Date): string {
  const parts = [`<loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`<lastmod>${lastmod.toISOString()}</lastmod>`);
  return `  <url>${parts.join("")}</url>`;
}

export async function renderSitemap(): Promise<string> {
  const [products, categories] = await Promise.all([
    // Newest first, as Torob asked: it reads the top of the list to find what
    // is new without walking the whole catalogue.
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { slug: true, updatedAt: true },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const entries = [
    urlEntry(siteUrl("/")),
    urlEntry(siteUrl("/products")),
    ...products.map((p) => urlEntry(siteUrl(`/products/${encodeURIComponent(p.slug)}`), p.updatedAt)),
    ...categories.map((c) =>
      urlEntry(siteUrl(`/categories/${encodeURIComponent(c.slug)}`), c.updatedAt),
    ),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}

/**
 * Keeps crawlers out of pages that are personal or only make sense signed in,
 * and points them at the sitemap.
 */
export function renderRobots(): string {
  return [
    "User-agent: *",
    "Disallow: /admin",
    "Disallow: /api/",
    "Disallow: /profile",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /payment",
    "",
    `Sitemap: ${siteUrl("/sitemap.xml")}`,
    "",
  ].join("\n");
}

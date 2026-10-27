import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { prisma } from "../../shared/prisma.js";

/**
 * Server-rendered `<head>` for product pages.
 *
 * The storefront is a single-page app: every URL is answered with the same
 * `index.html` and the page is built in the browser. Torob's crawler, and the
 * link previews of Telegram and WhatsApp, never run that JavaScript, so they
 * saw no product at all. Torob's merchant support asked for the tags below in
 * the HTML itself (Aban 1405).
 *
 * Only the head changes. The body is the untouched shell, so a visitor gets the
 * same app as on any other page.
 */

/** Marks every tag added here, so the app can drop them once it takes over. */
const SERVER_HEAD_ATTR = "data-server-head";

export interface ProductPageResult {
  statusCode: number;
  html: string;
}

let shell: Promise<string> | undefined;

/**
 * Read once per process. A release swaps the `current` symlink and then
 * reloads PM2, so a new build always arrives with a new process.
 */
export function loadShell(): Promise<string> {
  shell ??= readFile(path.resolve(env.WEB_INDEX_PATH), "utf8").catch((error: unknown) => {
    // Do not cache the failure: the file may appear once the build lands.
    shell = undefined;
    throw error;
  });
  return shell;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function metaName(name: string, content: string): string {
  return `<meta name="${name}" content="${escapeHtml(content)}" ${SERVER_HEAD_ATTR} />`;
}

function metaProperty(property: string, content: string): string {
  return `<meta property="${property}" content="${escapeHtml(content)}" ${SERVER_HEAD_ATTR} />`;
}

/** Uploads are stored as absolute URLs, demo images and older rows may not be. */
function absoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${env.APP_URL.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
}

/** Plain text, whitespace collapsed, cut at a word boundary. */
function summarise(text: string, max = 160): string {
  const plain = text.replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/**
 * Replaces the shell's own `<title>` and appends the given tags to the head.
 * The shell's title is generic and would otherwise win over ours, since a
 * document's title is its first `<title>` element.
 */
export function injectHead(html: string, title: string, tags: string[]): string {
  const headEnd = html.indexOf("</head>");
  if (headEnd === -1) {
    throw new Error("index.html has no </head>");
  }
  const block = [`<title ${SERVER_HEAD_ATTR}>${escapeHtml(title)}</title>`, ...tags]
    .map((tag) => `    ${tag}`)
    .join("\n");
  const withoutTitle = html
    .slice(0, headEnd)
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .trimEnd();
  return `${withoutTitle}\n${block}\n  ${html.slice(headEnd)}`;
}

async function readSiteSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["site_name", "site_title", "site_description", "default_guarantee"] } },
    select: { key: true, value: true },
  });
  return Object.fromEntries(rows.map((row) => [row.key, row.value.trim()]));
}

function withSiteTitle(title: string, settings: Record<string, string>): string {
  const siteTitle = settings.site_title || settings.site_name;
  return siteTitle ? `${title} | ${siteTitle}` : title;
}

export async function renderProductPage(slug: string): Promise<ProductPageResult> {
  const html = await loadShell();

  const [product, settings] = await Promise.all([
    prisma.product.findUnique({
      where: { slug, isActive: true },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        shortDescription: true,
        price: true,
        compareAtPrice: true,
        stockQuantity: true,
        sku: true,
        guarantee: true,
        metaTitle: true,
        metaDescription: true,
        images: {
          orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
          select: { url: true },
          take: 1,
        },
      },
    }),
    readSiteSettings(),
  ]);

  if (!product) {
    // A real 404 lets Torob and search engines drop a deleted or hidden
    // product. The app still loads and shows its own «not found» page.
    return {
      statusCode: 404,
      html: injectHead(html, withSiteTitle("محصول یافت نشد", settings), [
        metaName("robots", "noindex"),
      ]),
    };
  }

  const title = withSiteTitle(product.metaTitle || product.title, settings);
  const description =
    product.metaDescription ||
    product.shortDescription ||
    (product.description ? summarise(product.description) : "") ||
    settings.site_description ||
    "";
  const url = `${env.APP_URL.replace(/\/+$/, "")}/products/${encodeURIComponent(product.slug)}`;
  const image = product.images[0] ? absoluteUrl(product.images[0].url) : undefined;
  const inStock = product.stockQuantity > 0;
  const hasDiscount = product.compareAtPrice !== null && product.compareAtPrice > product.price;
  const guarantee = product.guarantee?.trim() || settings.default_guarantee || "";

  // schema.org has no Toman, so the structured data is priced in Rial.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    offers: {
      "@type": "Offer",
      url,
      price: product.price * 10,
      priceCurrency: "IRR",
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  const tags = [
    // Torob, exactly as their merchant guide names them. Prices are Toman.
    metaName("product_id", product.id),
    metaName("product_name", product.title),
    metaName("product_price", String(product.price)),
    ...(hasDiscount ? [metaName("product_old_price", String(product.compareAtPrice))] : []),
    metaName("availability", inStock ? "instock" : "outofstock"),
    ...(guarantee ? [metaName("guarantee", guarantee)] : []),

    // Search engines and link previews.
    ...(description ? [metaName("description", description)] : []),
    `<link rel="canonical" href="${escapeHtml(url)}" ${SERVER_HEAD_ATTR} />`,
    metaProperty("og:type", "product"),
    metaProperty("og:locale", "fa_IR"),
    ...(settings.site_name ? [metaProperty("og:site_name", settings.site_name)] : []),
    metaProperty("og:title", title),
    ...(description ? [metaProperty("og:description", description)] : []),
    metaProperty("og:url", url),
    ...(image ? [metaProperty("og:image", image)] : []),
    metaName("twitter:card", image ? "summary_large_image" : "summary"),
    // `<` is escaped so no product text can close the script element early.
    `<script type="application/ld+json" ${SERVER_HEAD_ATTR}>${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`,
  ];

  return { statusCode: 200, html: injectHead(html, title, tags) };
}

/** The shell as built, for when the product cannot be looked up. */
export async function renderFallback(): Promise<ProductPageResult> {
  return { statusCode: 200, html: await loadShell() };
}

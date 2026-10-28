import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import * as sitemapController from "./sitemap.controller.js";

/**
 * Mounted at the site root: crawlers look for these exact addresses. nginx
 * routes just these two paths here.
 */
export default async function sitemapRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // Crawlers are not shoppers; the API's per-IP bucket is not for them.
  app.get("/sitemap.xml", { config: { rateLimit: false } }, sitemapController.getSitemap);
  app.get("/robots.txt", { config: { rateLimit: false } }, sitemapController.getRobots);
}

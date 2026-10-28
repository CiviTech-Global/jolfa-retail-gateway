import type { FastifyReply, FastifyRequest } from "fastify";
import { asyncHandler } from "../../shared/async-handler.js";
import * as sitemapService from "./sitemap.service.js";

/**
 * Short-lived cache: a crawler re-reading the file within a few minutes gets
 * it from nginx or its own cache, and a new product still shows up quickly.
 */
const CRAWLER_CACHE = "public, max-age=600";

export const getSitemap = asyncHandler(
  async (_req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const xml = await sitemapService.renderSitemap();
    reply
      .header("content-type", "application/xml; charset=utf-8")
      .header("cache-control", CRAWLER_CACHE)
      .send(xml);
  },
);

export const getRobots = asyncHandler(
  async (_req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    reply
      .header("content-type", "text/plain; charset=utf-8")
      .header("cache-control", CRAWLER_CACHE)
      .send(sitemapService.renderRobots());
  },
);

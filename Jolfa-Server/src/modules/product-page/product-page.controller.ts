import type { FastifyReply, FastifyRequest } from "fastify";
import { asyncHandler } from "../../shared/async-handler.js";
import type { ProductParams } from "../products/product.types.js";
import * as productPageService from "./product-page.service.js";

export const getProductPage = asyncHandler(
  async (req: FastifyRequest<{ Params: ProductParams }>, reply: FastifyReply): Promise<void> => {
    let page: productPageService.ProductPageResult;
    try {
      page = await productPageService.renderProductPage(req.params.slug);
    } catch (error) {
      // The tags are an addition, not the page. If the lookup fails the shell
      // still loads the app, which then reports the problem the normal way.
      // A missing shell is not recoverable here and propagates as a 500, which
      // nginx answers with the static index.html instead.
      req.log.error({ err: error, slug: req.params.slug }, "product page head failed");
      page = await productPageService.renderFallback();
    }

    // Prices and stock change; a cached page would tell Torob a stale price.
    reply
      .status(page.statusCode)
      .header("content-type", "text/html; charset=utf-8")
      .header("cache-control", "no-cache")
      .send(page.html);
  },
);

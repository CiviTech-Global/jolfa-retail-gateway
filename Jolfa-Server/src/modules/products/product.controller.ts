import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import * as productService from "./product.service.js";
import type {
  ProductCreateBody,
  ProductListQuery,
  ProductParams,
  ProductUpdateBody,
} from "./product.types.js";

export const listProducts = asyncHandler(
  async (
    req: FastifyRequest<{ Querystring: ProductListQuery }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await productService.listProducts(req.query);
    sendSuccess(reply, result);
  }
);

export const getProductBySlug = asyncHandler(
  async (
    req: FastifyRequest<{ Params: ProductParams }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await productService.getProductBySlug(req.params.slug);
    sendSuccess(reply, result);
  }
);

export const createProduct = asyncHandler(
  async (
    req: FastifyRequest<{ Body: ProductCreateBody }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await productService.createProduct(req.body);
    sendSuccess(reply, result, 201);
  }
);

export const updateProduct = asyncHandler(
  async (
    req: FastifyRequest<{ Params: ProductParams; Body: ProductUpdateBody }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await productService.updateProduct(req.params.slug, req.body);
    sendSuccess(reply, result);
  }
);

export const deleteProduct = asyncHandler(
  async (
    req: FastifyRequest<{ Params: ProductParams }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await productService.deleteProduct(req.params.slug);
    sendSuccess(reply, result);
  }
);

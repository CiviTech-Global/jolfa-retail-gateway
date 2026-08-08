import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import * as categoryService from "./category.service.js";
import type {
  CategoryCreateBody,
  CategoryListQuery,
  CategoryParams,
  CategoryUpdateBody,
} from "./category.types.js";

export const listCategories = asyncHandler(
  async (
    req: FastifyRequest<{ Querystring: CategoryListQuery }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await categoryService.listCategories(req.query.tree, req.query.parentId);
    sendSuccess(reply, result);
  }
);

export const getCategoryBySlug = asyncHandler(
  async (
    req: FastifyRequest<{ Params: CategoryParams }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await categoryService.getCategoryBySlug(req.params.slug);
    sendSuccess(reply, result);
  }
);

export const createCategory = asyncHandler(
  async (
    req: FastifyRequest<{ Body: CategoryCreateBody }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await categoryService.createCategory(req.body);
    sendSuccess(reply, result, 201);
  }
);

export const updateCategory = asyncHandler(
  async (
    req: FastifyRequest<{ Params: CategoryParams; Body: CategoryUpdateBody }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await categoryService.updateCategory(req.params.slug, req.body);
    sendSuccess(reply, result);
  }
);

export const deleteCategory = asyncHandler(
  async (
    req: FastifyRequest<{ Params: CategoryParams }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await categoryService.deleteCategory(req.params.slug);
    sendSuccess(reply, result);
  }
);

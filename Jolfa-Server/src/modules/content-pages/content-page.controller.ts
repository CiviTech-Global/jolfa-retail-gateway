import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import * as contentPageService from "./content-page.service.js";
import type { ContentPageParams, ContentPageUpdateBody } from "./content-page.types.js";

export const getContentPage = asyncHandler(
  async (
    request: FastifyRequest<{ Params: ContentPageParams }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await contentPageService.getContentPage(request.params.slug);
    sendSuccess(reply, result);
  }
);

export const listContentPages = asyncHandler(
  async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = await contentPageService.listContentPages();
    sendSuccess(reply, result);
  }
);

export const updateContentPage = asyncHandler(
  async (
    request: FastifyRequest<{ Params: ContentPageParams; Body: ContentPageUpdateBody }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await contentPageService.updateContentPage(
      request.params.slug,
      request.body,
      request.user.id
    );
    sendSuccess(reply, result);
  }
);

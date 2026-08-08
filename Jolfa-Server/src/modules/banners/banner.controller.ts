import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import * as bannerService from "./banner.service.js";
import type {
  BannerCreateBody,
  BannerListQuery,
  BannerParams,
  BannerUpdateBody,
} from "./banner.types.js";

export const listBanners = asyncHandler(
  async (
    req: FastifyRequest<{ Querystring: BannerListQuery }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await bannerService.listBanners(req.query.position);
    sendSuccess(reply, result);
  }
);

export const listAllBanners = asyncHandler(
  async (_req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = await bannerService.listAllBanners();
    sendSuccess(reply, result);
  }
);

export const createBanner = asyncHandler(
  async (
    req: FastifyRequest<{ Body: BannerCreateBody }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await bannerService.createBanner(req.body);
    sendSuccess(reply, result, 201);
  }
);

export const updateBanner = asyncHandler(
  async (
    req: FastifyRequest<{ Params: BannerParams; Body: BannerUpdateBody }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await bannerService.updateBanner(req.params.id, req.body);
    sendSuccess(reply, result);
  }
);

export const deleteBanner = asyncHandler(
  async (
    req: FastifyRequest<{ Params: BannerParams }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await bannerService.deleteBanner(req.params.id);
    sendSuccess(reply, result);
  }
);

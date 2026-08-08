import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import * as settingsService from "./settings.service.js";
import type { SettingParams, SettingUpdateBody } from "./settings.types.js";

export const listPublicSettings = asyncHandler(
  async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = await settingsService.listPublicSettings();
    sendSuccess(reply, result);
  }
);

export const listAllSettings = asyncHandler(
  async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = await settingsService.listAllSettings();
    sendSuccess(reply, result);
  }
);

export const updateSetting = asyncHandler(
  async (
    request: FastifyRequest<{ Params: SettingParams; Body: SettingUpdateBody }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await settingsService.updateSetting(request.params.key, request.body);
    sendSuccess(reply, result);
  }
);

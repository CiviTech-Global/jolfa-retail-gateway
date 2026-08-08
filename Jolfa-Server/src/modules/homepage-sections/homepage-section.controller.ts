import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import {
  listActiveSections,
  listAllSections,
  createSection,
  updateSection,
  deleteSection,
} from "./homepage-section.service.js";
import type {
  HomepageSectionCreateBody,
  HomepageSectionUpdateBody,
  HomepageSectionParams,
} from "./homepage-section.types.js";

export const getActiveHomepageSections = asyncHandler(
  async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await listActiveSections();
    sendSuccess(reply, result.sections);
  }
);

export const getAllHomepageSections = asyncHandler(
  async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await listAllSections();
    sendSuccess(reply, result.sections);
  }
);

export const createHomepageSection = asyncHandler(
  async (
    request: FastifyRequest<{ Body: HomepageSectionCreateBody }>,
    reply: FastifyReply
  ) => {
    const result = await createSection(request.body);
    sendSuccess(reply, result.section, 201);
  }
);

export const updateHomepageSection = asyncHandler(
  async (
    request: FastifyRequest<{
      Params: HomepageSectionParams;
      Body: HomepageSectionUpdateBody;
    }>,
    reply: FastifyReply
  ) => {
    const result = await updateSection(request.params.id, request.body);
    sendSuccess(reply, result.section);
  }
);

export const deleteHomepageSection = asyncHandler(
  async (
    request: FastifyRequest<{ Params: HomepageSectionParams }>,
    reply: FastifyReply
  ) => {
    await deleteSection(request.params.id);
    sendSuccess(reply, { success: true });
  }
);

import type { FastifyReply, FastifyRequest } from "fastify";
import { asyncHandler } from "../../shared/async-handler.js";
import * as emallsService from "./emalls.service.js";
import type { EmallsQuery } from "./emalls.types.js";

export const getEmallsProducts = asyncHandler(
  async (req: FastifyRequest<{ Querystring: EmallsQuery }>, reply: FastifyReply): Promise<void> => {
    const feed = await emallsService.listEmallsProducts(req.query);
    reply.header("content-type", "application/json; charset=utf-8").send(feed);
  },
);

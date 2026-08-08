import type { FastifyReply, FastifyRequest, RouteHandlerMethod } from "fastify";

/**
 * Wraps an async route handler so that rejected promises are forwarded to
 * Fastify's error handler. This is only needed when the handler is not
 * declared as `async`; Fastify already handles async handlers by default.
 */
export function asyncHandler<
  Request extends FastifyRequest = FastifyRequest,
  Reply extends FastifyReply = FastifyReply,
>(handler: (req: Request, reply: Reply) => Promise<unknown>): RouteHandlerMethod {
  return async (req, reply) => {
    try {
      await handler(req as Request, reply as Reply);
    } catch (error) {
      reply.send(error);
    }
  };
}

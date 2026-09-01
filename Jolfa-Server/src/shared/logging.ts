import type { FastifyInstance } from "fastify";

const REQUEST_ID_HEADER = "x-request-id";

export function registerRequestLogging(app: FastifyInstance): void {
  app.addHook("onRequest", async (request) => {
    request.log.debug(
      { reqId: request.id, method: request.method, url: request.url, ip: request.ip },
      "request received",
    );
  });

  app.addHook("onResponse", async (request, reply) => {
    void reply.header(REQUEST_ID_HEADER, request.id);

    const payload = {
      reqId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTimeMs: Math.round(reply.elapsedTime),
    };

    if (reply.statusCode >= 500) {
      request.log.error(payload, "request completed");
    } else if (reply.statusCode >= 400) {
      request.log.warn(payload, "request completed");
    } else {
      request.log.info(payload, "request completed");
    }
  });
}

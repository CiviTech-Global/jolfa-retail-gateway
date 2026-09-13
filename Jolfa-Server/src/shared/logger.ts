import { pino } from "pino";
import { env } from "../config/env.js";

/**
 * A logger for code that runs outside a request.
 *
 * Fastify's `request.log` is the right tool inside a handler — it carries the
 * request id, so lines can be tied back to one customer's journey. Service-layer
 * code does not receive the request, and threading it through every call just to
 * log would distort the signatures.
 *
 * Deliberately matching `createFastifyInstance`'s settings (level and redaction)
 * so that both streams read the same way and neither can leak a credential that
 * the other would have masked.
 */
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : env.NODE_ENV === "test" ? "silent" : "debug",
  redact: {
    paths: ["merchant", "apiKey", "token", "password", "*.merchant", "*.apiKey"],
    censor: "[REDACTED]",
  },
});

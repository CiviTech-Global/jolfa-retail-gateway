import type { FastifyInstance } from "fastify";

/**
 * Process-level safety net.
 *
 * Fastify's error handler only sees errors thrown inside a request. An
 * unhandled promise rejection in a background task — an audit write, an SMS
 * send — bypasses it entirely, and Node's default for those is to terminate the
 * process with a message that never reaches the application log.
 *
 * The policy here is deliberate and differs per case:
 *
 *   unhandledRejection  Log and keep serving. These are usually a forgotten
 *                       `await` on a non-critical side effect; killing the
 *                       process would turn a cosmetic bug into an outage.
 *
 *   uncaughtException   Log and exit. The process is in an unknown state after
 *                       one of these, so continuing risks serving corrupted
 *                       responses. The process manager restarts us clean.
 */
export function registerCrashHandlers(app: FastifyInstance): void {
  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    app.log.error({ err: error, fatal: false }, "unhandled promise rejection");
  });

  process.on("uncaughtException", (error) => {
    app.log.fatal({ err: error, fatal: true }, "uncaught exception, exiting");

    // Give the logger a moment to flush before the process disappears; without
    // this the very message explaining the crash is the one that gets lost.
    setTimeout(() => process.exit(1), 100).unref();
  });
}

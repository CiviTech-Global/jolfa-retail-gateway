import type { FastifyInstance } from "fastify";
/**
 * Builds a fully-wired Fastify app (all plugins/routes/error-handler
 * registered) without binding a network port, for use with `app.inject()`
 * in integration tests. Does NOT run `seedDefaults()` — tests create their
 * own fixtures via `test/helpers/factories.ts` instead.
 */
export declare function createTestApp(): Promise<FastifyInstance>;
//# sourceMappingURL=build-app.d.ts.map
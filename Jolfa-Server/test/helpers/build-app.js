import { buildApp, createFastifyInstance } from "../../src/index.js";
/**
 * Builds a fully-wired Fastify app (all plugins/routes/error-handler
 * registered) without binding a network port, for use with `app.inject()`
 * in integration tests. Does NOT run `seedDefaults()` — tests create their
 * own fixtures via `test/helpers/factories.ts` instead.
 */
export async function createTestApp() {
    const app = createFastifyInstance();
    await buildApp(app);
    await app.ready();
    return app;
}
//# sourceMappingURL=build-app.js.map
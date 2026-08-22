import { config as loadEnv } from "dotenv";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Runs ONCE per `vitest` invocation, before any test file is loaded.
 *
 * Applying migrations here rather than in `setup.ts` matters: `setupFiles`
 * runs per test file, so a `prisma migrate deploy` there costs ~18s x N files
 * (it was the single largest cost in the suite). `prisma migrate deploy` is
 * idempotent, so running it once per session is equivalent and far cheaper.
 */
export default function globalSetup(): void {
  loadEnv({ path: path.resolve(process.cwd(), ".env.test"), override: true });

  execSync("npx prisma migrate deploy", {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  // `@fastify/static` refuses to register against a missing root, which would
  // otherwise emit a warning on every app build and break upload tests.
  mkdirSync(path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads-test"), {
    recursive: true,
  });
}

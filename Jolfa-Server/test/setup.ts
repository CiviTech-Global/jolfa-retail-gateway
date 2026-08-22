import { config as loadEnv } from "dotenv";
import path from "node:path";
import { afterAll, afterEach, beforeAll } from "vitest";

// Point everything at the dedicated test database instead of dev's .env.
// `override: true` matters: `src/index.ts` imports `dotenv/config` at module
// load, so `.env` would otherwise win.
loadEnv({ path: path.resolve(process.cwd(), ".env.test"), override: true });

// Migrations are applied once per session by `test/global-setup.ts`, not here.
const { prisma } = await import("../src/shared/prisma.js");

async function truncateAllTables(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations')
  `;
  if (tables.length === 0) return;

  const names = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE;`);
}

beforeAll(async () => {
  await truncateAllTables();
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await prisma.$disconnect();
});

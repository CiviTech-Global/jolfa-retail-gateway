import { config as loadEnv } from "dotenv";
import { execSync } from "node:child_process";
import path from "node:path";
import { afterAll, afterEach, beforeAll } from "vitest";

// Point everything at the dedicated test database instead of dev's .env.
loadEnv({ path: path.resolve(process.cwd(), ".env.test"), override: true });

// Idempotent: only applies migrations that aren't already recorded, so this
// is cheap to re-run at the top of every test file.
execSync("npx prisma migrate deploy", {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

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

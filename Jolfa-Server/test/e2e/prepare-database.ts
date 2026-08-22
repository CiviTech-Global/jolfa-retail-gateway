/**
 * Prepares the end-to-end database, then exits.
 *
 * Lives inside Jolfa-Server (not e2e/) so that `@prisma/client` and the
 * migration CLI resolve from this package's own node_modules. Playwright's
 * global setup shells out to it with DATABASE_URL already pointing at the
 * e2e database.
 *
 *   1. Creates the database if it does not exist (connecting to the
 *      `postgres` maintenance database to issue CREATE DATABASE).
 *   2. Applies migrations with `prisma migrate deploy`.
 *   3. Truncates every table so each run starts from a known-empty state.
 *   4. Seeds the admin/customer accounts by calling the server's own
 *      `seedDefaults()`.
 *
 * Step 4 is not redundant with the server seeding itself on boot: Playwright
 * starts `webServer` BEFORE `globalSetup`, so the server's own seed runs first
 * and step 3 would otherwise delete the very accounts the specs log in with.
 * Seeding here makes the outcome correct regardless of that ordering.
 */
import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[e2e:db] DATABASE_URL is required");
  process.exit(1);
}

const parsed = new URL(databaseUrl);
const databaseName = parsed.pathname.replace(/^\//, "");
if (!databaseName) {
  console.error("[e2e:db] DATABASE_URL has no database name");
  process.exit(1);
}

// Guard rail: this script truncates everything it touches, so refuse to point
// at anything that isn't obviously a throwaway e2e database.
if (!/e2e/i.test(databaseName)) {
  console.error(
    `[e2e:db] refusing to prepare "${databaseName}" — the e2e database name must contain "e2e"`,
  );
  process.exit(1);
}

async function ensureDatabaseExists(): Promise<void> {
  const maintenanceUrl = new URL(databaseUrl!);
  maintenanceUrl.pathname = "/postgres";

  const prisma = new PrismaClient({ datasources: { db: { url: maintenanceUrl.toString() } } });
  try {
    const existing = await prisma.$queryRawUnsafe<{ datname: string }[]>(
      "SELECT datname FROM pg_database WHERE datname = $1",
      databaseName,
    );

    if (existing.length > 0) {
      console.log(`[e2e:db] database "${databaseName}" already exists`);
      return;
    }

    // CREATE DATABASE cannot run inside a transaction, and the name cannot be
    // parameterised — it is validated against a strict pattern instead.
    if (!/^[a-z0-9_]+$/i.test(databaseName)) {
      throw new Error(`unsafe database name: ${databaseName}`);
    }
    await prisma.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    console.log(`[e2e:db] created database "${databaseName}"`);
  } finally {
    await prisma.$disconnect();
  }
}

async function truncateAllTables(): Promise<void> {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl! } } });
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations')
    `;
    if (tables.length === 0) return;

    const names = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE;`);
    console.log(`[e2e:db] truncated ${tables.length} tables`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  await ensureDatabaseExists();

  execSync("npx prisma migrate deploy", {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  await truncateAllTables();

  // Imported lazily: loading it pulls in config/env.js, which validates the
  // full server env — that must happen after the checks above, so a missing
  // DATABASE_URL reports the clear message from this script instead.
  const { seedDefaults } = await import("../../src/shared/seed.js");
  await seedDefaults();

  console.log("[e2e:db] ready");
}

main().catch((error: unknown) => {
  console.error("[e2e:db] failed:", error);
  process.exit(1);
});

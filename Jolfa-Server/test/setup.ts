import { config as loadEnv } from "dotenv";
import { execSync } from "node:child_process";
import path from "node:path";
import { afterAll, afterEach, beforeAll } from "vitest";

// Point everything at the dedicated test database instead of dev's .env.
const testEnvPath = path.resolve(process.cwd(), ".env.test");
loadEnv({ path: testEnvPath, override: true });

// `override: true` above would otherwise reinstate a provider credential that
// the env file happens to declare, defeating the blanks set in
// vitest.config.ts — see the comment there for why none of these may be live
// in a test run. Blanked rather than deleted, because a deleted key is one
// `dotenv/config` will happily load again when a test builds the app.
for (const key of [
  "SMS_IR_API_KEY",
  "SMS_IR_OTP_TEMPLATE_ID",
  "SMS_SENDER_NUMBER",
]) {
  process.env[key] = "";
}

// Idempotent: only applies migrations that aren't already recorded, so this
// is cheap to re-run at the top of every test file.
execSync("npx prisma migrate deploy", {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

const { prisma } = await import("../src/shared/prisma.js");
const { flushNotifications } = await import("../src/shared/sms/notification-queue.js");

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
  // Notifications fired without being awaited (order placed, paid, shipped)
  // would otherwise still be writing while the tables are truncated, and their
  // rows would surface inside the next test.
  await flushNotifications();
  await truncateAllTables();
});

afterAll(async () => {
  await prisma.$disconnect();
});

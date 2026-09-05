import { afterEach, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcrypt";
import { prisma } from "./prisma.js";
import { seedDefaults } from "./seed.js";
import { env } from "../config/env.js";

/**
 * `seedDefaults()` runs on every boot. It used to rewrite the seeded admin's
 * password from the environment each time, which quietly undid any password
 * change made through the admin UI on the next restart or deploy — leaving the
 * account pinned to a value stored in a rendered `.env` while the administrator
 * believed they had rotated it.
 *
 * These tests exist to keep that from coming back.
 */
describe("seedDefaults", () => {
  const phone = "09120000001";
  const seedPassword = "seed-password-1";

  // `env` is validated and frozen at import, so the seed inputs are set here
  // rather than through process.env, which is read only at startup.
  const mutableEnv = env as unknown as Record<string, string | undefined>;
  let originalPhone: string | undefined;
  let originalPassword: string | undefined;
  let originalEmail: string | undefined;

  beforeEach(async () => {
    originalPhone = mutableEnv.ADMIN_SEED_PHONE;
    originalPassword = mutableEnv.ADMIN_SEED_PASSWORD;
    originalEmail = mutableEnv.ADMIN_SEED_EMAIL;

    mutableEnv.ADMIN_SEED_PHONE = phone;
    mutableEnv.ADMIN_SEED_PASSWORD = seedPassword;
    mutableEnv.ADMIN_SEED_EMAIL = undefined;

    await prisma.user.deleteMany({ where: { phone } });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { phone } });
    mutableEnv.ADMIN_SEED_PHONE = originalPhone;
    mutableEnv.ADMIN_SEED_PASSWORD = originalPassword;
    mutableEnv.ADMIN_SEED_EMAIL = originalEmail;
  });

  it("creates the admin user when it does not exist", async () => {
    await seedDefaults();

    const created = await prisma.user.findFirstOrThrow({ where: { phone } });
    expect(created.role).toBe("ADMIN");
    expect(await bcrypt.compare(seedPassword, created.passwordHash)).toBe(true);
  });

  it("does NOT overwrite a password that was changed after seeding", async () => {
    await seedDefaults();

    // Stand in for an administrator changing their password in the admin UI.
    const chosen = "chosen-by-the-admin-9";
    await prisma.user.update({
      where: { id: (await prisma.user.findFirstOrThrow({ where: { phone } })).id },
      data: { passwordHash: await bcrypt.hash(chosen, 12) },
    });

    // The next deploy, restart, or crash-loop iteration.
    await seedDefaults();

    const after = await prisma.user.findFirstOrThrow({ where: { phone } });
    expect(await bcrypt.compare(chosen, after.passwordHash)).toBe(true);
    expect(await bcrypt.compare(seedPassword, after.passwordHash)).toBe(false);
  });

  it("still restores role and active flag on an existing user", async () => {
    await seedDefaults();
    const seeded = await prisma.user.findFirstOrThrow({ where: { phone } });

    await prisma.user.update({
      where: { id: seeded.id },
      data: { isActive: false, role: "CUSTOMER" },
    });

    await seedDefaults();

    const after = await prisma.user.findFirstOrThrow({ where: { phone } });
    expect(after.isActive).toBe(true);
    expect(after.role).toBe("ADMIN");
  });
});

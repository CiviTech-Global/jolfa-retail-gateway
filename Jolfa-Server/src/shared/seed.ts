import bcrypt from "bcrypt";
import { prisma } from "./prisma.js";
import { env } from "../config/env.js";
import { ensureDefaultSettings } from "../modules/settings/settings.service.js";
import { pruneRetiredSections } from "../modules/homepage-sections/homepage-section.service.js";

interface SeedUser {
  email?: string;
  phone: string;
  password: string;
  firstName: string;
  role: "ADMIN" | "CUSTOMER";
}

/**
 * Creates the seed user if it is missing. If it already exists, its password is
 * LEFT ALONE.
 *
 * This used to rewrite `passwordHash` from the environment on every call, and
 * `seedDefaults()` runs on every boot. The effect was that an administrator
 * could change their password in the admin UI, see it succeed, and have it
 * silently reverted to the seed value by the next restart or deploy — while
 * believing the old credential was dead. The seed password is written in a
 * rendered `.env` and in the deployment notes, so that is a real exposure and
 * not just a papercut.
 *
 * The seed exists to make a fresh database usable, not to pin the credential
 * forever, so it now only ever sets a password at creation time.
 */
async function upsertSeedUser(input: SeedUser): Promise<{ created: boolean }> {
  const existing = await prisma.user.findFirst({
    where: { phone: input.phone },
  });

  if (existing) {
    // Role and active flag are still reconciled: locking yourself out of the
    // only admin account is recoverable this way, and neither is a secret.
    // `passwordHash` is deliberately absent from this update.
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        role: input.role,
        ...(input.email ? { email: input.email } : {}),
      },
    });
    return { created: false };
  }

  await prisma.user.create({
    data: {
      phone: input.phone,
      email: input.email ?? null,
      passwordHash: await bcrypt.hash(input.password, 12),
      firstName: input.firstName,
      role: input.role,
      isActive: true,
    },
  });
  return { created: true };
}

export async function seedDefaults(): Promise<void> {
  // Branding and storefront toggles must exist before an admin can edit them.
  try {
    await ensureDefaultSettings();
  } catch (error) {
    console.error("[seed] Failed to seed default settings:", error);
  }

  // Clears homepage sections whose type the app no longer renders.
  try {
    const removed = await pruneRetiredSections();
    if (removed > 0) {
      console.log(`[seed] Removed ${removed} homepage section(s) of retired types.`);
    }
  } catch (error) {
    console.error("[seed] Failed to prune retired homepage sections:", error);
  }

  const seeds: SeedUser[] = [];

  if (env.ADMIN_SEED_PHONE && env.ADMIN_SEED_PASSWORD) {
    seeds.push({
      email: env.ADMIN_SEED_EMAIL,
      phone: env.ADMIN_SEED_PHONE,
      password: env.ADMIN_SEED_PASSWORD,
      firstName: "مدیر",
      role: "ADMIN",
    });
  }

  if (env.USER_SEED_PHONE && env.USER_SEED_PASSWORD) {
    if (env.USER_SEED_PHONE === env.ADMIN_SEED_PHONE) {
      console.warn(
        "[seed] USER_SEED_PHONE is the same as ADMIN_SEED_PHONE; skipping default customer user."
      );
    } else {
      seeds.push({
        email: env.USER_SEED_EMAIL,
        phone: env.USER_SEED_PHONE,
        password: env.USER_SEED_PASSWORD,
        firstName: "مشتری",
        role: "CUSTOMER",
      });
    }
  }

  for (const seed of seeds) {
    try {
      const { created } = await upsertSeedUser(seed);
      console.log(
        created
          ? `[seed] Created ${seed.role.toLowerCase()} user: ${seed.phone}`
          : `[seed] ${seed.role.toLowerCase()} user ${seed.phone} already exists; password left unchanged`
      );
    } catch (error) {
      console.error(`[seed] Failed to seed ${seed.role} user:`, error);
    }
  }
}

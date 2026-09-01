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

async function upsertSeedUser(input: SeedUser): Promise<{ created: boolean }> {
  const existing = await prisma.user.findFirst({
    where: { phone: input.phone },
  });

  const passwordHash = await bcrypt.hash(input.password, 12);

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
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
      passwordHash,
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
        `[seed] ${created ? "Created" : "Updated"} ${seed.role.toLowerCase()} user: ${seed.phone}`
      );
    } catch (error) {
      console.error(`[seed] Failed to seed ${seed.role} user:`, error);
    }
  }
}

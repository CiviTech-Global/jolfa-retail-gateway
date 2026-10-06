import { prisma } from "../prisma.js";

/**
 * The shop's name, as the admin set it, for use in message bodies.
 *
 * Read from settings rather than hardcoded so a rebrand changes every SMS at
 * once — the last one renamed the shop to ارس پرو and left stale copy scattered
 * through the codebase for weeks.
 */
export async function resolveSiteName(): Promise<string> {
  const setting = await prisma.setting.findUnique({
    where: { key: "site_name" },
    select: { value: true },
  });
  return setting?.value?.trim() || "فروشگاه";
}

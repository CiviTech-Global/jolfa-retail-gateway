import { prisma } from "../../shared/prisma.js";
import { NotFoundError } from "../../shared/app-error.js";
import type { SettingUpdateBody } from "./settings.types.js";

export async function listPublicSettings() {
  const settings = await prisma.setting.findMany({
    where: { isPublic: true },
    orderBy: { group: "asc" },
    select: {
      key: true,
      value: true,
      group: true,
      description: true,
    },
  });
  return { settings };
}

export async function listAllSettings() {
  const settings = await prisma.setting.findMany({
    orderBy: [{ group: "asc" }, { key: "asc" }],
  });
  return { settings };
}

export async function updateSetting(key: string, data: SettingUpdateBody) {
  const existing = await prisma.setting.findUnique({ where: { key } });
  if (!existing) {
    throw new NotFoundError("Setting");
  }

  const setting = await prisma.setting.update({
    where: { key },
    data: { value: data.value },
  });

  return { setting };
}

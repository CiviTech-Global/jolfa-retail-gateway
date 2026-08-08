import { z } from "zod";

export const settingUpdateSchema = z.object({
  value: z.string(),
});

export const settingParamsSchema = z.object({
  key: z.string().min(1),
});

export type SettingUpdateBody = z.infer<typeof settingUpdateSchema>;
export type SettingParams = z.infer<typeof settingParamsSchema>;

import { z } from "zod";

export const bannerListQuerySchema = z.object({
  position: z.string().max(50).optional().or(z.literal("").transform(() => undefined)),
});

export const bannerCreateBodySchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional().or(z.literal("").transform(() => undefined)),
  imageUrl: z.string().min(1).max(500),
  link: z.string().max(500).optional().or(z.literal("").transform(() => undefined)),
  position: z.string().min(1).max(50).default("hero"),
  displayOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const bannerUpdateBodySchema = bannerCreateBodySchema.partial();

export const bannerParamsSchema = z.object({
  id: z.string().uuid(),
});

export type BannerListQuery = z.infer<typeof bannerListQuerySchema>;
export type BannerCreateBody = z.infer<typeof bannerCreateBodySchema>;
export type BannerUpdateBody = z.infer<typeof bannerUpdateBodySchema>;
export type BannerParams = z.infer<typeof bannerParamsSchema>;
